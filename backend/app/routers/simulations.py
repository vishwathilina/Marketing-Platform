"""
Simulation management routes - start, status, and results
"""
from fastapi import APIRouter, Depends, HTTPException, status
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
    RiskFlagResponse
)
from app.dependencies import get_current_user
from app.config import get_settings

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
        import redis
        import ssl as ssl_module
        try:
            redis_kwargs = {}
            if settings.redis_url.startswith("rediss://"):
                redis_kwargs["ssl_cert_reqs"] = ssl_module.CERT_REQUIRED
            r = redis.from_url(settings.redis_url, **redis_kwargs)
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
        agent_sample=sample_data
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
