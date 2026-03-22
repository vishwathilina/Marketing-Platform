"""
Simulation management routes - start, status, and results
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models import User, Project, SimulationRun, RiskFlag, AgentLog
from app.schemas import (
    SimulationCreate, 
    SimulationResponse, 
    SimulationStatusResponse,
    SimulationResultsResponse,
    RiskFlagResponse,
    MapDataResponse,
    AgentDetailResponse,
    AgentProfileData,
)
from app.dependencies import get_current_user
from app.config import get_settings
from app.services.report_service import generate_simulation_report

settings = get_settings()
router = APIRouter(prefix="/simulations", tags=["Simulations"])


@router.post("/{project_id}/start", response_model=SimulationResponse)
async def start_simulation(
    project_id: str,
    config: SimulationCreate = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a new simulation for a project
    """
    # Verify project exists and belongs to user
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check if project is ready (VLM processing complete)
    if project.status != "READY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project is not ready for simulation. Current status: {project.status}"
        )
    
    # Use default config if not provided
    if config is None:
        config = SimulationCreate()
    
    # Create simulation run record
    simulation = SimulationRun(
        project_id=project.id,
        num_agents=config.num_agents,
        simulation_days=config.simulation_days,
        use_custom_agents_only=config.use_custom_agents_only,
        agent_ids=config.agent_ids,
        status="PENDING"
    )
    
    db.add(simulation)
    db.commit()
    db.refresh(simulation)
    
    # Start simulation task (async)
    from app.tasks import run_simulation_task
    run_simulation_task.delay(str(simulation.id))
    
    return simulation


@router.get("/{simulation_id}", response_model=SimulationResponse)
async def get_simulation(
    simulation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get simulation details
    """
    simulation = db.query(SimulationRun).join(Project).filter(
        SimulationRun.id == simulation_id,
        Project.user_id == current_user.id
    ).first()
    
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation not found"
        )
    
    return simulation


@router.get("/{simulation_id}/status", response_model=SimulationStatusResponse)
async def get_simulation_status(
    simulation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current simulation status (for polling)
    """
    simulation = db.query(SimulationRun).join(Project).filter(
        SimulationRun.id == simulation_id,
        Project.user_id == current_user.id
    ).first()
    
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation not found"
        )
    
    # Calculate progress for running simulations
    progress = None
    current_day = None
    active_agents = None
    
    if simulation.status == "RUNNING":
        # Get progress from Redis cache if available
        from app.redis_client import get_redis_client
        try:
            r = get_redis_client()
            cached = r.get(f"sim:{simulation_id}:status")
            if cached:
                import json
                status_data = json.loads(cached)
                progress = status_data.get("progress")
                current_day = status_data.get("current_day")
                active_agents = status_data.get("active_agents")
        except:
            pass
    elif simulation.status == "COMPLETED":
        progress = 100
    
    return SimulationStatusResponse(
        id=simulation.id,
        status=simulation.status,
        progress=progress,
        current_day=current_day,
        active_agents=active_agents
    )


@router.get("/{simulation_id}/results", response_model=SimulationResultsResponse)
async def get_simulation_results(
    simulation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get full simulation results with risk flags
    """
    simulation = db.query(SimulationRun).join(Project).filter(
        SimulationRun.id == simulation_id,
        Project.user_id == current_user.id
    ).first()
    
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation not found"
        )
    
    if simulation.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Simulation has not completed yet"
        )
    
    # Get risk flags
    risk_flags = db.query(RiskFlag).filter(
        RiskFlag.simulation_run_id == simulation.id
    ).order_by(RiskFlag.severity.desc()).all()
    
    # Get sample agent logs
    agent_sample = db.query(AgentLog).filter(
        AgentLog.simulation_run_id == simulation.id,
        AgentLog.event_type.in_(["BOYCOTT", "ENDORSEMENT"])
    ).limit(10).all()
    
    sample_data = [
        {
            "agent_id": log.agent_id,
            "event_type": log.event_type,
            "event_data": log.event_data,
            "timestamp": log.timestamp.isoformat()
        }
        for log in agent_sample
    ]
    
    return SimulationResultsResponse(
        simulation=simulation,
        risk_flags=risk_flags,
        agent_sample=sample_data,
        opinion_trajectory=simulation.opinion_trajectory
    )


@router.get("/project/{project_id}", response_model=List[SimulationResponse])
async def list_project_simulations(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all simulations for a project
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    simulations = db.query(SimulationRun).filter(
        SimulationRun.project_id == project_id
    ).order_by(SimulationRun.created_at.desc()).all()
    
    return simulations


@router.get("/{simulation_id}/map-data", response_model=MapDataResponse)
async def get_simulation_map_data(
    simulation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get lightweight map data for all agents in a completed simulation.
    Returns coordinates, opinion and friends for each agent.
    """
    simulation = db.query(SimulationRun).join(Project).filter(
        SimulationRun.id == simulation_id,
        Project.user_id == current_user.id
    ).first()
    
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation not found"
        )
    
    if simulation.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Simulation has not completed yet"
        )
    
    map_data = simulation.map_data or []
    return MapDataResponse(map_data=map_data)


@router.get("/{simulation_id}/agents/{agent_id}", response_model=AgentDetailResponse)
async def get_agent_detail(
    simulation_id: str,
    agent_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get full detail for a specific agent in a simulation.
    Returns profile, emotion, opinion, reasoning and friends.
    """
    simulation = db.query(SimulationRun).join(Project).filter(
        SimulationRun.id == simulation_id,
        Project.user_id == current_user.id
    ).first()
    
    if not simulation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation not found"
        )
    
    if simulation.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Simulation has not completed yet"
        )
    
    # Find the agent in agent_states
    agent_states = simulation.agent_states or []
    agent_data = None
    for state in agent_states:
        if state.get("agent_id") == agent_id:
            agent_data = state
            break
    
    if not agent_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found in simulation"
        )
    
    profile_raw = agent_data.get("profile", {})
    return AgentDetailResponse(
        agent_id=agent_data["agent_id"],
        coordinates=agent_data.get("coordinates", [0, 0]),
        opinion=agent_data.get("opinion", "NEUTRAL"),
        emotion=agent_data.get("emotion", "neutral"),
        emotion_intensity=agent_data.get("emotion_intensity", 0),
        reasoning=agent_data.get("reasoning", ""),
        friends=agent_data.get("friends", []),
        profile=AgentProfileData(
            name=profile_raw.get("name"),
            age=profile_raw.get("age"),
            gender=profile_raw.get("gender"),
            location=profile_raw.get("location"),
            occupation=profile_raw.get("occupation"),
            education=profile_raw.get("education"),
            income_level=profile_raw.get("income_level"),
            religion=profile_raw.get("religion"),
            ethnicity=profile_raw.get("ethnicity"),
            social_media_usage=profile_raw.get("social_media_usage"),
            political_leaning=profile_raw.get("political_leaning"),
            values=profile_raw.get("values", []),
            personality_traits=profile_raw.get("personality_traits", []),
        ),
    )


@router.get("/{simulation_id}/report")
async def download_simulation_report(
    simulation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    simulation = db.query(SimulationRun).join(Project).filter(
        SimulationRun.id == simulation_id,
        Project.user_id == current_user.id
    ).first()

    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found")

    if simulation.status != "COMPLETED":
        raise HTTPException(status_code=400, detail="Simulation not completed")

    risk_flags = db.query(RiskFlag).filter(
        RiskFlag.simulation_run_id == simulation.id
    ).all()

    agent_logs = db.query(AgentLog).filter(
        AgentLog.simulation_run_id == simulation.id
    ).all()

    report_path = generate_simulation_report(
        simulation,
        risk_flags,
        agent_logs
    )

    return FileResponse(
        report_path,
        media_type="application/pdf",
        filename="simulation_report.pdf"
    )
