"""
Celery tasks for background processing
"""
import logging
from celery import Celery
from datetime import datetime
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery(
    "agentsociety",
    broker=settings.redis_url,
    backend=settings.redis_url
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
)


@celery_app.task(bind=True)
def process_video_task(self, project_id: str):
    """
    Background task to process video with VLM
    """
    from app.database import SessionLocal
    from app.models import Project
    from app.services.vlm_service import process_video
    
    db = SessionLocal()
    
    try:
        # Get project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.error(f"Project not found: {project_id}")
            return {"error": "Project not found"}
        
        # Update status
        project.status = "PROCESSING"
        db.commit()
        
        logger.info(f"Processing video for project {project_id}")
        
        # Process video
        descriptions, duration = process_video(project.video_path)
        
        # Update project with results
        project.vlm_generated_context = descriptions
        project.video_duration_seconds = duration
        project.status = "READY"
        db.commit()
        
        logger.info(f"Video processing complete for project {project_id}")
        
        return {
            "project_id": project_id,
            "status": "READY",
            "duration": duration
        }
        
    except Exception as e:
        logger.error(f"Video processing failed for project {project_id}: {e}")
        try:
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                project.status = "FAILED"
                db.commit()
        except:
            pass
        return {"error": str(e)}
    finally:
        db.close()


@celery_app.task(bind=True)
def run_simulation_task(self, simulation_id: str):
    """
    Background task to run agent simulation
    """
    from app.database import SessionLocal
    from app.models import SimulationRun, Project, AgentLog, RiskFlag
    import json
    import redis
    
    db = SessionLocal()
    redis_client = redis.from_url(settings.redis_url)
    
    try:
        # Get simulation
        simulation = db.query(SimulationRun).filter(SimulationRun.id == simulation_id).first()
        if not simulation:
            logger.error(f"Simulation not found: {simulation_id}")
            return {"error": "Simulation not found"}
        
        # Get project
        project = db.query(Project).filter(Project.id == simulation.project_id).first()
        if not project or not project.vlm_generated_context:
            logger.error(f"Project not ready for simulation: {simulation.project_id}")
            simulation.status = "FAILED"
            simulation.error_message = "Project video analysis not complete"
            db.commit()
            return {"error": "Project not ready"}
        
        # Update status
        simulation.status = "RUNNING"
        simulation.started_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Starting simulation {simulation_id} with {simulation.num_agents} agents")
        
        # Run simulation using Ray
        from simulation.run_simulation import run_simulation
        
        results = run_simulation(
            experiment_id=str(simulation.id),
            ad_content=project.vlm_generated_context,
            demographic_filter=project.demographic_filter,
            num_agents=simulation.num_agents,
            simulation_days=simulation.simulation_days,
            redis_client=redis_client
        )
        
        # Save results
        simulation.status = "COMPLETED"
        simulation.completed_at = datetime.utcnow()
        simulation.virality_score = results.get("virality_score", 0)
        simulation.sentiment_breakdown = results.get("sentiment_breakdown", {})
        
        # Save agent logs
        for log_data in results.get("agent_logs", []):
            agent_log = AgentLog(
                simulation_run_id=simulation.id,
                agent_id=log_data["agent_id"],
                event_type=log_data["event_type"],
                event_data=log_data.get("event_data", {})
            )
            db.add(agent_log)
        
        # Save risk flags
        for flag_data in results.get("risk_flags", []):
            risk_flag = RiskFlag(
                simulation_run_id=simulation.id,
                flag_type=flag_data["flag_type"],
                severity=flag_data["severity"],
                description=flag_data["description"],
                affected_demographics=flag_data.get("affected_demographics"),
                sample_agent_reactions=flag_data.get("sample_agent_reactions")
            )
            db.add(risk_flag)
        
        db.commit()
        
        logger.info(f"Simulation {simulation_id} completed successfully")
        
        return {
            "simulation_id": simulation_id,
            "status": "COMPLETED",
            "virality_score": results.get("virality_score", 0)
        }
        
    except Exception as e:
        logger.error(f"Simulation failed for {simulation_id}: {e}")
        try:
            simulation = db.query(SimulationRun).filter(SimulationRun.id == simulation_id).first()
            if simulation:
                simulation.status = "FAILED"
                simulation.error_message = str(e)
                simulation.completed_at = datetime.utcnow()
                db.commit()
        except:
            pass
        return {"error": str(e)}
    finally:
        db.close()
