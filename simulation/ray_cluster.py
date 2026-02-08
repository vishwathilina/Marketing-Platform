"""
Ray cluster initialization and utilities
"""
import logging
import ray

logger = logging.getLogger(__name__)


def init_ray_cluster(
    num_cpus: int = None,
    num_gpus: int = 0,
    local_mode: bool = False,
    dashboard_host: str = "0.0.0.0",
    address: str = None
):
    """
    Initialize Ray cluster
    
    Args:
        num_cpus: Number of CPUs to use (None = auto-detect)
        num_gpus: Number of GPUs to use
        local_mode: Run in local mode for debugging
        dashboard_host: Dashboard host binding
        address: Existing cluster address to connect to
    
    Returns:
        Ray context info
    """
    if ray.is_initialized():
        logger.info("Ray already initialized, shutting down first")
        ray.shutdown()
    
    if address:
        # Connect to existing cluster
        logger.info(f"Connecting to Ray cluster at {address}")
        context = ray.init(address=address)
    else:
        # Start local cluster
        # Disable log_to_driver to fix compatibility with Celery's LoggingProxy
        logger.info("Initializing local Ray cluster")
        context = ray.init(
            num_cpus=num_cpus,
            num_gpus=num_gpus,
            local_mode=local_mode,
            dashboard_host=dashboard_host,
            logging_level=logging.WARNING,  # Reduce logging noise
            ignore_reinit_error=True,
            log_to_driver=False,  # Fix for Celery LoggingProxy compatibility
            configure_logging=False  # Don't reconfigure logging
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
