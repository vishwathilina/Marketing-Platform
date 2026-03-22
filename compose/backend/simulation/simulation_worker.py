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
import time
from redis.exceptions import ConnectionError as RedisConnectionError
import asyncio
import logging
import signal
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict

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
        self.redis_client = None
        self.running = False
        self.request_channel = "simulation_requests"
        self.reconnect_delay = 2
        self.max_reconnect_delay = 30

        # Database connection string
        self.db_url = os.getenv(
            "DATABASE_URL",
            "postgresql://agentsociety:dev_password@localhost:5432/agentsociety_db"
        )

        logger.info(f"SimulationWorker initialized with Redis: {self.redis_url}")

    def _create_redis_client(self):
        """Create a fresh Redis client, with TLS support for rediss:// URLs."""
        if self.redis_url.startswith("rediss://"):
            import ssl as ssl_module
            return redis.from_url(
                self.redis_url,
                ssl_cert_reqs=ssl_module.CERT_REQUIRED,
                socket_keepalive=True,
                health_check_interval=30,
            )
        return redis.from_url(
            self.redis_url,
            socket_keepalive=True,
            health_check_interval=30,
        )

    def run(self):
        """Main loop: listen for simulation requests with auto-reconnect."""
        self.running = True

        logger.info("=" * 60)
        logger.info("Ray Simulation Worker Started")
        logger.info(f"Listening for simulation requests on '{self.request_channel}'")
        logger.info("=" * 60)

        backoff = self.reconnect_delay

        while self.running:
            pubsub = None
            client = None

            try:
                client = self._create_redis_client()
                pubsub = client.pubsub(ignore_subscribe_messages=True)
                pubsub.subscribe(self.request_channel)

                self.redis_client = client
                backoff = self.reconnect_delay  # reset on successful connect

                logger.info("Connected to Redis and subscribed successfully")

                while self.running:
                    message = pubsub.get_message(timeout=1.0)
                    if message is None:
                        continue

                    if message["type"] != "message":
                        continue

                    try:
                        data = json.loads(message["data"])
                        self._handle_request(data)
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON in message: {e}")
                    except Exception as e:
                        logger.exception(f"Error handling request: {e}")

            except (RedisConnectionError, OSError) as e:
                if not self.running:
                    break
                logger.warning(
                    f"Redis connection lost: {e}. Reconnecting in {backoff}s..."
                )
                time.sleep(backoff)
                backoff = min(backoff * 2, self.max_reconnect_delay)

            except Exception as e:
                if not self.running:
                    break
                logger.exception(
                    f"Unexpected worker loop error: {e}. Retrying in {backoff}s..."
                )
                time.sleep(backoff)
                backoff = min(backoff * 2, self.max_reconnect_delay)

            finally:
                try:
                    if pubsub is not None:
                        pubsub.close()
                except Exception:
                    pass

                try:
                    if client is not None:
                        client.close()
                except Exception:
                    pass

                if self.redis_client is client:
                    self.redis_client = None

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
                simulation_days=request.get('simulation_days', 5),
                custom_agent_profiles=request.get('custom_agent_profiles'),
                use_custom_agents_only=request.get('use_custom_agents_only', False)
            )

            # Publish results to Redis
            result_message = {
                'simulation_id': simulation_id,
                'status': 'COMPLETED',
                'results': results,
                'completed_at': datetime.utcnow().isoformat()
            }

            if self.redis_client is not None:
                self.redis_client.publish(
                    "simulation_results",
                    json.dumps(result_message, default=str)
                )
            else:
                logger.warning(
                    f"Redis client unavailable; could not publish COMPLETED result "
                    f"for simulation {simulation_id}"
                )

            logger.info(f"=== Simulation Complete: {simulation_id} ===")
            logger.info(
                f"  Engagement Score: {results.get('engagement_score', 0):.2f}"
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

            if self.redis_client is not None:
                self.redis_client.publish(
                    "simulation_results",
                    json.dumps(error_message)
                )
            else:
                logger.warning(
                    f"Redis client unavailable; could not publish FAILED result "
                    f"for simulation {simulation_id}"
                )

    def _run_simulation(
        self,
        simulation_id: str,
        ad_content: str,
        demographic_filter: Optional[dict],
        num_agents: int,
        simulation_days: int,
        custom_agent_profiles: Optional[List[Dict]] = None,
        use_custom_agents_only: bool = False
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
            custom_agent_profiles=custom_agent_profiles,
            use_custom_agents_only=use_custom_agents_only
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
