"""
Standalone Ray Simulation Worker

This module runs as a SEPARATE PROCESS from Celery, listening to Redis
for simulation requests and executing them using Ray.

Architecture:
  Celery (VLM) → publishes to Redis → Simulation Worker (Ray) → publishes results

Usage:
  python simulation/simulation_worker.py

This avoids the Ray/Celery conflict by keeping them in separate processes.
"""
import os
import sys
import json
import asyncio
import logging
import signal
from pathlib import Path
from datetime import datetime
from typing import Optional

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(project_root / ".env")

import redis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger('simulation_worker')


class SimulationWorker:
    """
    Standalone worker that:
    1. Listens to Redis for simulation requests
    2. Runs simulations using Ray (via async orchestrator)
    3. Publishes results back to Redis
    """

    def __init__(self):
        """Initialize the worker"""
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

        # For rediss:// (TLS), pass ssl_cert_reqs explicitly
        if self.redis_url.startswith("rediss://"):
            import ssl as ssl_module
            self.redis_client = redis.from_url(
                self.redis_url,
                ssl_cert_reqs=ssl_module.CERT_REQUIRED,
            )
        else:
            self.redis_client = redis.from_url(self.redis_url)

        self.running = False

        # Database connection string
        self.db_url = os.getenv(
            "DATABASE_URL",
            "postgresql://agentsociety:dev_password@localhost:5432/agentsociety_db"
        )

        logger.info(f"SimulationWorker initialized with Redis: {self.redis_url}")

    def run(self):
        """Main loop: listen for simulation requests"""
        self.running = True

        # Subscribe to simulation requests channel
        pubsub = self.redis_client.pubsub()
        pubsub.subscribe("simulation_requests")

        logger.info("=" * 60)
        logger.info("Ray Simulation Worker Started")
        logger.info("Listening for simulation requests on 'simulation_requests' channel")
        logger.info("=" * 60)

        try:
            for message in pubsub.listen():
                if not self.running:
                    break

                if message['type'] == 'message':
                    try:
                        data = json.loads(message['data'])
                        self._handle_request(data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in message: {e}")
                    except Exception as e:
                        logger.error(f"Error handling request: {e}")

        finally:
            pubsub.unsubscribe()

    def _handle_request(self, request: dict):
        """Handle a simulation request"""
        simulation_id = request.get('simulation_id')

        if not simulation_id:
            logger.error("Request missing simulation_id")
            return

        logger.info(f"=== Starting Simulation: {simulation_id} ===")
        logger.info(f"  Agents: {request.get('num_agents', 10)}")
        logger.info(f"  Days: {request.get('simulation_days', 5)}")

        try:
            # Run the simulation using async orchestrator
            results = self._run_simulation(
                simulation_id=simulation_id,
                ad_content=request.get('ad_content', ''),
                demographic_filter=request.get('demographic_filter'),
                num_agents=request.get('num_agents', 10),
                simulation_days=request.get('simulation_days', 5)
            )

            # Publish results to Redis
            result_message = {
                'simulation_id': simulation_id,
                'status': 'COMPLETED',
                'results': results,
                'completed_at': datetime.utcnow().isoformat()
            }

            self.redis_client.publish(
                "simulation_results",
                json.dumps(result_message, default=str)
            )

            logger.info(f"=== Simulation Complete: {simulation_id} ===")
            logger.info(
                f"  Virality Score: {results.get('virality_score', 0):.2f}"
            )
            logger.info(
                f"  Risk Flags: {len(results.get('risk_flags', []))}"
            )

        except Exception as e:
            logger.error(f"Simulation {simulation_id} failed: {e}")

            # Publish error to Redis
            error_message = {
                'simulation_id': simulation_id,
                'status': 'FAILED',
                'error': str(e),
                'completed_at': datetime.utcnow().isoformat()
            }

            self.redis_client.publish(
                "simulation_results",
                json.dumps(error_message)
            )

    def _run_simulation(
        self,
        simulation_id: str,
        ad_content: str,
        demographic_filter: Optional[dict],
        num_agents: int,
        simulation_days: int
    ) -> dict:
        """Run the actual simulation using async orchestrator"""
        from simulation.run_simulation import run_simulation

        return run_simulation(
            experiment_id=simulation_id,
            ad_content=ad_content,
            demographic_filter=demographic_filter,
            num_agents=num_agents,
            simulation_days=simulation_days,
            redis_client=self.redis_client,
        )

    def stop(self):
        """Stop the worker"""
        self.running = False
        logger.info("Stopping simulation worker...")


def main():
    """Entry point"""
    worker = SimulationWorker()

    # Handle graceful shutdown
    def signal_handler(sig, frame):
        print("\nShutting down gracefully...")
        worker.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run the worker
    worker.run()


if __name__ == "__main__":
    main()
