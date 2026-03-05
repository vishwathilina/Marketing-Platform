"""
Results Listener - Background thread that listens for simulation results from Ray worker

This runs as a background thread in the FastAPI application, listening to Redis
for simulation results and updating the database accordingly.
"""
import os
import json
import logging
import threading
from datetime import datetime
from typing import Optional

import redis
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import SimulationRun, AgentLog, RiskFlag

logger = logging.getLogger(__name__)


class ResultsListener:
    """Background listener for simulation results from Ray worker"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.running = False
        self.thread: Optional[threading.Thread] = None
        
    def start(self):
        """Start the listener in a background thread"""
        if self.running:
            logger.warning("ResultsListener already running")
            return
            
        self.running = True
        self.thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.thread.start()
        logger.info("ResultsListener started")
    
    def stop(self):
        """Stop the listener"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        logger.info("ResultsListener stopped")
    
    def _listen_loop(self):
        """Main listening loop"""
        try:
            import ssl as ssl_module
            redis_kwargs = {}
            if self.redis_url.startswith("rediss://"):
                redis_kwargs["ssl_cert_reqs"] = ssl_module.CERT_REQUIRED
            redis_client = redis.from_url(self.redis_url, **redis_kwargs)
            pubsub = redis_client.pubsub()
            pubsub.subscribe("simulation_results")
            
            logger.info("Subscribed to 'simulation_results' channel")
            
            for message in pubsub.listen():
                if not self.running:
                    break
                
                if message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        self._handle_result(data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in result: {e}")
                    except Exception as e:
                        logger.error(f"Error handling result: {e}")
            
            pubsub.unsubscribe()
            
        except Exception as e:
            logger.error(f"ResultsListener error: {e}")
            self.running = False
    
    def _handle_result(self, data: dict):
        """Process a simulation result from Ray worker"""
        simulation_id = data.get('simulation_id')
        status = data.get('status', 'FAILED')
        
        if not simulation_id:
            logger.error("Result missing simulation_id")
            return
        
        logger.info(f"Received result for simulation {simulation_id}: {status}")
        
        db = SessionLocal()
        try:
            simulation = db.query(SimulationRun).filter(
                SimulationRun.id == simulation_id
            ).first()
            
            if not simulation:
                logger.error(f"Simulation {simulation_id} not found in database")
                return
            
            if status == 'COMPLETED':
                results = data.get('results', {})
                
                # Update simulation with results
                simulation.status = "COMPLETED"
                simulation.completed_at = datetime.utcnow()
                simulation.virality_score = results.get('virality_score', 0)
                simulation.sentiment_breakdown = results.get('sentiment_breakdown', {})
                
                db.commit()
                logger.info(f"Simulation {simulation_id} marked as COMPLETED")
                
                # Save agent logs (separate transaction to avoid rollback issues)
                try:
                    self._save_agent_logs(db, simulation.id, results.get('agent_logs', []))
                except Exception as e:
                    logger.warning(f"Failed to save agent logs: {e}")
                
                # Save risk flags
                try:
                    self._save_risk_flags(db, simulation.id, results.get('risk_flags', []))
                except Exception as e:
                    logger.warning(f"Failed to save risk flags: {e}")
                
            else:
                # Failed simulation
                simulation.status = "FAILED"
                simulation.completed_at = datetime.utcnow()
                simulation.error_message = data.get('error', 'Unknown error')
                db.commit()
                logger.info(f"Simulation {simulation_id} marked as FAILED: {data.get('error')}")
        
        except Exception as e:
            logger.error(f"Database error handling result: {e}")
            db.rollback()
        finally:
            db.close()
    
    def _save_agent_logs(self, db: Session, simulation_id: str, logs: list):
        """Save agent logs to database"""
        # Limit to prevent overwhelming the database
        for log_data in logs[:50]:
            try:
                event_data = log_data.get('event_data', {})
                # Ensure JSON serializable
                if isinstance(event_data, dict):
                    event_data = json.loads(json.dumps(event_data, default=str))
                
                agent_log = AgentLog(
                    simulation_run_id=simulation_id,
                    agent_id=str(log_data.get('agent_id', 'unknown')),
                    event_type=str(log_data.get('event_type', 'UNKNOWN')),
                    event_data=event_data
                )
                db.add(agent_log)
            except Exception as e:
                logger.warning(f"Failed to add agent log: {e}")
        
        db.commit()
        logger.info(f"Saved {min(50, len(logs))} agent logs for simulation {simulation_id}")
    
    def _save_risk_flags(self, db: Session, simulation_id: str, flags: list):
        """Save risk flags to database"""
        for flag_data in flags:
            try:
                risk_flag = RiskFlag(
                    simulation_run_id=simulation_id,
                    flag_type=str(flag_data.get('flag_type', 'UNKNOWN')),
                    severity=str(flag_data.get('severity', 'LOW')),
                    description=str(flag_data.get('description', '')),
                    affected_demographics=flag_data.get('affected_demographics'),
                    sample_agent_reactions=flag_data.get('sample_agent_reactions')
                )
                db.add(risk_flag)
            except Exception as e:
                logger.warning(f"Failed to add risk flag: {e}")
        
        db.commit()
        logger.info(f"Saved {len(flags)} risk flags for simulation {simulation_id}")


# Global instance
_results_listener: Optional[ResultsListener] = None


def get_results_listener() -> ResultsListener:
    """Get or create the global results listener"""
    global _results_listener
    if _results_listener is None:
        _results_listener = ResultsListener()
    return _results_listener


def start_results_listener(redis_url: str = None):
    """Start the global results listener"""
    global _results_listener
    if _results_listener is None:
        _results_listener = ResultsListener(redis_url=redis_url)
    _results_listener.start()


def stop_results_listener():
    """Stop the global results listener"""
    if _results_listener:
        _results_listener.stop()
