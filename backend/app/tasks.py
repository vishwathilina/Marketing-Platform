"""
Celery tasks for background processing
"""
import os
import sys
import logging
from celery import Celery
from datetime import datetime
from app.config import get_settings

# Add simulation directory to path (it's a sibling of backend)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
simulation_path = os.path.join(project_root, "simulation")
if simulation_path not in sys.path:
    sys.path.insert(0, project_root)

settings = get_settings()
logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery(
    "agentsociety",
    broker=settings.redis_url,
    backend=settings.redis_url
)

import ssl as ssl_module

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    broker_connection_retry_on_startup=True,  # silence CPendingDeprecationWarning in Celery 5/6
)

# Enable SSL for rediss:// connections (e.g. Upstash)
if settings.redis_url.startswith("rediss://"):
    celery_app.conf.update(
        broker_use_ssl={"ssl_cert_reqs": ssl_module.CERT_REQUIRED},
        redis_backend_use_ssl={"ssl_cert_reqs": ssl_module.CERT_REQUIRED},
    )


@celery_app.task(bind=True)
def process_video_task(self, project_id: str):
    """
    Background task to process video with VLM
    """
    from app.database import SessionLocal
    from app.models import Project
    from app.services.vlm_service import process_video
    
    db = None
    
    try:
        db = SessionLocal()
        # Get project
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            logger.error(f"Project not found: {project_id}")
            return {"error": "Project not found"}
        
        # Update status
        project.status = "PROCESSING"
        video_path = project.video_path
        db.commit()
        db.close()
        
        logger.info(f"Processing video for project {project_id}")
        
        # Process video
        descriptions, duration = process_video(video_path)
        
        db = SessionLocal()
        project = db.query(Project).filter(Project.id == project_id).first()
        
        # Update project with results
        if project:
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
            db_err = SessionLocal()
            project = db_err.query(Project).filter(Project.id == project_id).first()
            if project:
                project.status = "FAILED"
                db_err.commit()
            db_err.close()
        except:
            pass
        return {"error": str(e)}
    finally:
        if db is not None:
            db.close()


@celery_app.task(bind=True)
def run_simulation_task(self, simulation_id: str):
    """
    Background task to queue simulation for Ray worker
    
    This task:
    1. Validates the simulation and project
    2. Publishes request to Redis 'simulation_requests' channel
    3. Ray worker (separate process) handles the actual simulation
    4. Results listener updates the database when complete
    """
    from app.database import SessionLocal
    from app.models import SimulationRun, Project
    import json
    import redis
    
    db = SessionLocal()
    redis_kwargs = {}
    if settings.redis_url.startswith("rediss://"):
        redis_kwargs["ssl_cert_reqs"] = ssl_module.CERT_REQUIRED
    
    redis_client = None
    try:
        redis_client = redis.from_url(settings.redis_url, **redis_kwargs)
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
        
        # Update status to RUNNING (Ray worker will process)
        simulation.status = "RUNNING"
        simulation.started_at = datetime.utcnow()
        db.commit()
        
        logger.info(f"Sending simulation {simulation_id} to Ray worker")
        
        # Publish request to Redis for Ray worker
        request = {
            "simulation_id": str(simulation.id),
            "project_id": str(project.id),
            "ad_content": project.vlm_generated_context,
            "demographic_filter": project.demographic_filter,
            "num_agents": simulation.num_agents,
            "simulation_days": simulation.simulation_days
        }
        
        try:
            redis_client.publish("simulation_requests", json.dumps(request))
        except Exception as e:
            logger.error(f"Redis publish failed: {e}")
            simulation.status = "FAILED"
            simulation.error_message = f"Failed to dispatch to simulation worker: {str(e)}"
            db.commit()
            return {"error": str(e)}
        
        logger.info(f"Simulation {simulation_id} published to Ray worker queue")
        
        return {
            "simulation_id": simulation_id,
            "status": "RUNNING",
            "message": "Simulation sent to Ray worker for processing"
        }
        
    except Exception as e:
        logger.error(f"Failed to queue simulation {simulation_id}: {e}")
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
        if redis_client:
            redis_client.close()