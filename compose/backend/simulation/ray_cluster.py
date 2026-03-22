"""
Ray cluster initialization and utilities
"""
import logging
import os
import ray

logger = logging.getLogger(__name__)


def _clean_env(name: str, default: str = "") -> str:
    """Read env var and trim surrounding whitespace/newlines."""
    return (os.getenv(name, default) or default).strip()


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
    api_key = _clean_env("GEMINI_API_KEY", "")
    api_keys = _clean_env("GEMINI_API_KEYS", "")
    if api_keys:
        key_count = len([k for k in api_keys.split(",") if k.strip()])
        logger.info(f"GEMINI_API_KEYS found ({key_count} keys for rotation)")
    elif api_key:
        logger.info(f"GEMINI_API_KEY found ({len(api_key)} chars, starts with {api_key[:8]}...)")
    else:
        logger.error("GEMINI_API_KEY is NOT set! LLM calls will fail.")
        
    qwen_api_url = _clean_env("QWEN_API_URL", "")
    if not qwen_api_url:
        logger.warning("QWEN_API_URL is not set, using default HuggingFace endpoint")
        qwen_api_url = "https://vish85521-qwen.hf.space/api/generate"
        
    qwen_model_name = _clean_env("QWEN_MODEL_NAME", "qwen3.5:397b-cloud")
        
    runtime_env = {
        "env_vars": {
            "GEMINI_API_KEY": api_key,
            "GEMINI_API_KEYS": api_keys,
            "QWEN_API_URL": qwen_api_url,
            "QWEN_MODEL_NAME": qwen_model_name,
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
        # Ray's runtime_env/context.py replaces spaces with "\ " in worker
        # script paths, turning e.g. "CGP 1" into "CGP\ 1" which is invalid
        # on Windows. Fix: use a temp dir without spaces for Ray's internal
        # files AND copy the worker scripts there so the path has no spaces.
        import tempfile
        import shutil
        ray_temp = os.path.join(tempfile.gettempdir(), "ray_agentsociety")
        os.makedirs(ray_temp, exist_ok=True)
        logger.info(f"Using Ray temp dir: {ray_temp}")

        # Copy default_worker.py to space-free path if needed
        extra_init_kwargs = {}
        ray_private_dir = os.path.join(
            os.path.dirname(ray.__file__), "_private"
        )
        worker_src = os.path.join(
            ray_private_dir, "workers", "default_worker.py"
        )
        if " " in worker_src and os.path.exists(worker_src):
            workers_dest = os.path.join(ray_temp, "workers")
            os.makedirs(workers_dest, exist_ok=True)
            worker_dst = os.path.join(workers_dest, "default_worker.py")
            shutil.copy2(worker_src, worker_dst)
            # Also copy setup_worker.py if it exists
            setup_src = os.path.join(
                ray_private_dir, "workers", "setup_worker.py"
            )
            if os.path.exists(setup_src):
                shutil.copy2(
                    setup_src,
                    os.path.join(workers_dest, "setup_worker.py"),
                )
            logger.info(
                f"Copied Ray workers to space-free path: {workers_dest}"
            )
            # Tell Ray to use the space-free worker path
            extra_init_kwargs["_system_config"] = {
                "worker_register_timeout_seconds": 120,
            }
            # Monkey-patch the default worker path before ray.init()
            import ray._private.parameter as ray_parameter
            original_update = ray_parameter.RayParams.update_if_absent
            _patched_worker_path = worker_dst
            _patched_setup_path = os.path.join(
                workers_dest, "setup_worker.py"
            )

            def patched_update_if_absent(self, **kwargs):
                if "worker_path" in kwargs:
                    kwargs["worker_path"] = _patched_worker_path
                if "setup_worker_path" in kwargs and os.path.exists(
                    _patched_setup_path
                ):
                    kwargs["setup_worker_path"] = _patched_setup_path
                return original_update(self, **kwargs)

            ray_parameter.RayParams.update_if_absent = patched_update_if_absent
            logger.info("Patched Ray worker path to avoid spaces-in-path bug")

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
            **extra_init_kwargs,
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
