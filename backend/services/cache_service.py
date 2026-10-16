try:
    import redis
except Exception:
    redis = None  # type: ignore

import os
import json
import time
import hashlib
from pathlib import Path
from functools import wraps
from typing import Optional, Any, Callable
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
ENABLE_REDIS = os.getenv("ENABLE_REDIS", "false").lower() in ("true", "1", "yes")

# ====================== PERSISTENT LOCAL DISK + MEMORY CACHE ======================
_in_memory_cache: dict[str, dict[str, Any]] = {}
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache_store"
try:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

def _get_disk_path(key: str) -> Path:
    # Hash key to a safe filename
    key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{key_hash}.json"

# ====================== REDIS CLIENT (OPTIONAL) ======================
redis_client = None
if redis is not None and ENABLE_REDIS:
    try:
        redis_client = redis.from_url(
            REDIS_URL, 
            decode_responses=True,
            socket_timeout=0.5,
            socket_connect_timeout=0.5
        )
        redis_client.ping()
        print("[Cache] Connected to Redis successfully.")
    except Exception:
        print("[Cache] Redis not reached. Using high-speed in-memory & disk cache.")
        redis_client = None
else:
    # When Redis is not explicitly enabled, use fast in-memory + disk cache with zero delay
    redis_client = None

# ====================== GET / SET HELPERS ======================

def get_cache(key: str) -> Optional[Any]:
    now = time.time()
    
    # 1. Check ultra-fast RAM memory cache first (< 0.1ms)
    mem_item = _in_memory_cache.get(key)
    if mem_item:
        if mem_item['expires'] > now:
            return mem_item['value']
        else:
            del _in_memory_cache[key]

    # 2. Check Redis if available
    if redis_client:
        try:
            data = redis_client.get(key)
            if data:
                val = json.loads(data)
                # Populate in-memory for instant next access
                _in_memory_cache[key] = {'value': val, 'expires': now + 300}
                return val
        except Exception:
            pass

    # 3. Check persistent disk cache
    try:
        disk_file = _get_disk_path(key)
        if disk_file.exists():
            with open(disk_file, "r", encoding="utf-8") as f:
                disk_data = json.load(f)
            if disk_data.get("expires", 0) > now:
                val = disk_data.get("value")
                # Promote to in-memory cache
                _in_memory_cache[key] = {'value': val, 'expires': disk_data["expires"]}
                return val
            else:
                disk_file.unlink(missing_ok=True)
    except Exception:
        pass

    return None

def set_cache(key: str, value: Any, expire_seconds: int = 3600):
    now = time.time()
    expires = now + expire_seconds

    # 1. Write to in-memory RAM cache
    _in_memory_cache[key] = {
        'value': value,
        'expires': expires
    }

    # 2. Write to Redis if available
    if redis_client:
        try:
            redis_client.setex(key, expire_seconds, json.dumps(value))
        except Exception:
            pass

    # 3. Persist to disk cache
    try:
        disk_file = _get_disk_path(key)
        payload = {
            'key': key,
            'expires': expires,
            'value': value
        }
        with open(disk_file, "w", encoding="utf-8") as f:
            json.dump(payload, f)
    except Exception:
        pass

def invalidate_cache(key: str):
    _in_memory_cache.pop(key, None)
    if redis_client:
        try:
            redis_client.delete(key)
        except Exception:
            pass
    try:
        disk_file = _get_disk_path(key)
        disk_file.unlink(missing_ok=True)
    except Exception:
        pass

# ====================== CACHING DECORATOR ======================

def cached(key_prefix: str, ttl: int = 3600):
    """
    Decorator that auto-caches function results in memory + disk + Redis.
    Cache key is built from the prefix + function arguments.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            args_key = ":".join(str(a) for a in args) if args else ""
            kwargs_key = ":".join(f"{k}={v}" for k, v in sorted(kwargs.items())) if kwargs else ""
            cache_key = f"{key_prefix}:{args_key}:{kwargs_key}".rstrip(":")
            
            cached_result = get_cache(cache_key)
            if cached_result is not None:
                return cached_result
            
            result = func(*args, **kwargs)
            if result is not None:
                set_cache(cache_key, result, expire_seconds=ttl)
            return result
        return wrapper
    return decorator
