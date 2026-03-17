import redis
import functools
import ssl as ssl_module
from app.config import get_settings

@functools.lru_cache()
def get_redis_client():
    settings = get_settings()
    redis_kwargs = {}
    if settings.redis_url.startswith("rediss://"):
        redis_kwargs["ssl_cert_reqs"] = ssl_module.CERT_REQUIRED
    return redis.from_url(settings.redis_url, **redis_kwargs)
