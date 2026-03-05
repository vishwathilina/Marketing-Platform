"""
Ray cluster initialization and utilities
"""
import logging
import os
import ray

logger = logging.getLogger(__name__)


def init_ray_cluster(
    num_cpus: int = None,
    num_gpus: int = 0,
    address: str = None
):
    """
    Initialize Ray cluster

    Args:
        num_cpus: Number of CPUs to use (None = auto-detect)
        num_gpus: Number of GPUs to use
        address: Existing cluster address to connect to

    Returns:
        Ray context info
    """
    if ray.is_initialized():
        logger.info("Ray already initialized, shutting down first")
        ray.shutdown()

    # Get API key(s) to pass to workers via runtime_env
    api_key = os.getenv("GEMINI_API_KEY", "")
    api_keys = os.getenv("GEMINI_API_KEYS", "")
    if api_keys:
        key_count = len([k for k in api_keys.split(",") if k.strip()])
        logger.info(f"GEMINI_API_KEYS found ({key_count} keys for rotation)")
    elif api_key:
        logger.info(f"GEMINI_API_KEY found ({len(api_key)} chars, starts with {api_key[:8]}...)")
    else:
        logger.error("GEMINI_API_KEY is NOT set! LLM calls will fail.")
    runtime_env = {
        "env_vars": {
            "GEMINI_API_KEY": api_key,
            "GEMINI_API_KEYS": api_keys,
        }
    }

    if address:
        # Connect to existing cluster
        logger.info(f"Connecting to Ray cluster at {address}")
        context = ray.init(address=address, runtime_env=runtime_env)
    else:
        # Start local cluster
        logger.info("Initializing local Ray cluster")

        # Workaround: Ray on Windows breaks if project path contains spaces.
        # Use a temp dir without spaces for Ray's internal files.
        import tempfile
        ray_temp = os.path.join(tempfile.gettempdir(), "ray_agentsociety")
        os.makedirs(ray_temp, exist_ok=True)
        logger.info(f"Using Ray temp dir: {ray_temp}")

        context = ray.init(
            num_cpus=num_cpus,
            num_gpus=num_gpus,
            include_dashboard=False,
            logging_level=logging.WARNING,
            ignore_reinit_error=True,
            log_to_driver=True,
            configure_logging=False,
            runtime_env=runtime_env,
            _temp_dir=ray_temp,
        )

    resources = ray.available_resources()
    logger.info(f"Ray initialized with resources: {resources}")

    return context


def shutdown_ray():
    """Shutdown Ray cluster"""
    if ray.is_initialized():
        ray.shutdown()
        logger.info("Ray cluster shut down")


def get_cluster_info() -> dict:
    """Get current cluster information"""
    if not ray.is_initialized():
        return {"status": "not_initialized"}

    return {
        "status": "running",
        "resources": ray.available_resources(),
        "nodes": len(ray.nodes())
    }
