from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import asyncio
from starlette.concurrency import run_in_threadpool
from services import yt_service, db_service
from services.cache_service import get_cache, set_cache
from api import routes, auth_routes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema
    db_service.init_db()

    async def _startup_warm():
        try:
            # Pre-initialize shared YoutubeDL
            await run_in_threadpool(yt_service.get_shared_ydl)
            
            # Pre-warm home feed cache if needed
            cache_key = "home_vibe_popular_sections_v7"
            data = get_cache(cache_key)
            if not data:
                print("[Startup] Pre-warming home feed in background...")
                data = await run_in_threadpool(yt_service.get_home)
                if data and data.get("sections"):
                    set_cache(cache_key, data, expire_seconds=3600)
                    print("[Startup] Home feed cached successfully.")
            
            # Pre-warm stream cache for top trending tracks
            if data:
                top_tracks = (data.get("trending") or data.get("tracks") or [])[:5]
                for t in top_tracks:
                    vid = t.get("videoId")
                    if vid:
                        s_key = f"stream_info:{vid}:high"
                        if not get_cache(s_key):
                            info = await run_in_threadpool(yt_service.get_audio_stream_info, vid)
                            if info and info.get("url"):
                                set_cache(s_key, info, expire_seconds=14400)
                print("[Startup] Top audio streams pre-warmed.")
        except Exception as e:
            print(f"[Startup] Note: {e}")

    asyncio.create_task(_startup_warm())
    yield

app = FastAPI(title="VibeMusic API", version="1.0.0", lifespan=lifespan)

# ----------------- SECURITY & RATE LIMITING -----------------
import time
from collections import defaultdict
from fastapi import Request
from starlette.responses import JSONResponse

# In-memory sliding-window request tracker for DDoS & brute-force mitigation
_rate_limit_history: dict[str, list[tuple[float, str]]] = defaultdict(list)
_last_cleanup_timestamp = time.time()

def check_rate_limit(client_ip: str, path: str) -> tuple[bool, int]:
    """
    Tiered rate limiting:
      - Auth brute-force defense (/api/auth/login, /api/auth/register): max 15 req/min
      - Resource-heavy endpoints (/api/spotify/import-url, /api/download): max 30 req/min
      - General playback & search endpoints: max 600 req/min (high headroom, zero user lag)
    """
    global _last_cleanup_timestamp
    now = time.time()

    # Periodic cleanup of expired records every 5 minutes
    if now - _last_cleanup_timestamp > 300:
        cutoff = now - 60.0
        for ip in list(_rate_limit_history.keys()):
            _rate_limit_history[ip] = [entry for entry in _rate_limit_history[ip] if entry[0] > cutoff]
            if not _rate_limit_history[ip]:
                del _rate_limit_history[ip]
        _last_cleanup_timestamp = now

    if path.startswith("/api/auth/login") or path.startswith("/api/auth/register"):
        tier = "auth"
        max_req = 15
    elif path.startswith("/api/spotify/import-url") or path.startswith("/api/download"):
        tier = "resource"
        max_req = 30
    else:
        tier = "general"
        max_req = 600

    window = 60.0
    cutoff = now - window
    entries = [t for t, grp in _rate_limit_history[client_ip] if grp == tier and t > cutoff]

    if len(entries) >= max_req:
        earliest = min(entries)
        retry_after = max(1, int(window - (now - earliest)))
        return False, retry_after

    _rate_limit_history[client_ip].append((now, tier))
    return True, 0

@app.middleware("http")
async def security_and_rate_limiting_middleware(request: Request, call_next):
    # 1. Skip preflight OPTIONS requests from rate limiting
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if path.startswith("/api"):
        client_ip = request.client.host if request.client else "127.0.0.1"
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        allowed, retry_after = check_rate_limit(client_ip, path)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many requests. Please slow down.",
                    "detail": "Rate limit exceeded for this endpoint.",
                    "retry_after_seconds": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": "Exceeded"
                }
            )

    response = await call_next(request)

    # 2. Hardened Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Remove or obscure backend server header to prevent banner grabbing
    if "server" in response.headers:
        response.headers["server"] = "VibeMusic-Gateway"

    return response

# ----------------- HARDENED CORS CONFIGURATION -----------------
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [
    frontend_url,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]

# Allows localhost, LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x), and production Vercel/Railway domains
allowed_origin_regex = r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$|^https://.*\.vercel\.app$|^https://.*\.railway\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "Content-Disposition"],
)

app.include_router(auth_routes.auth_router, prefix="/api")
app.include_router(auth_routes.user_router, prefix="/api")
app.include_router(auth_routes.spotify_router, prefix="/api")
app.include_router(routes.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "VibeMusic API is running", "status": "healthy"}

@app.get("/api/version")
async def get_version():
    import shutil
    import subprocess
    from services.yt_service import get_cookie_file_path
    
    cp = get_cookie_file_path()
    c_count = 0
    if cp and os.path.exists(cp):
        with open(cp, "r", encoding="utf-8", errors="ignore") as f:
            c_count = len([l for l in f if l.strip() and not l.startswith("#")])
    
    deno_path = shutil.which("deno")
    deno_ver = "unknown"
    if deno_path:
        try:
            res = subprocess.run([deno_path, "--version"], capture_output=True, text=True, timeout=3)
            deno_ver = res.stdout.strip()
        except Exception as e:
            deno_ver = f"error: {e}"

    node_path = shutil.which("node")
    node_ver = "unknown"
    if node_path:
        try:
            res = subprocess.run([node_path, "--version"], capture_output=True, text=True, timeout=3)
            node_ver = res.stdout.strip()
        except Exception as e:
            node_ver = f"error: {e}"

    # Test quick extraction of a single track with yt-dlp to inspect exact Render error
    test_err = None
    test_fmt = None
    try:
        from services import yt_service
        info = yt_service.get_best_audio_url("RcSX0hOWcQ0", quality="standard")
        if info:
            test_fmt = {
                "client": info.get("client"),
                "format": info.get("ext"),
                "url_prefix": info.get("url", "")[:60]
            }
    except Exception as e:
        test_err = str(e)

    return {
        "version": "1.0.6",
        "cookies_loaded": c_count,
        "cookie_file": cp,
        "deno_version": deno_ver,
        "node_version": node_ver,
        "path": os.environ.get("PATH", "")[:200],
        "test_extraction": test_fmt,
        "test_error": test_err
    }

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "security": {
            "rate_limiting": "active",
            "security_headers": "active",
            "cors_policy": "restricted_origins_and_private_lan",
            "sql_injection_defense": "parameterized_sqlite",
            "password_hashing": "pbkdf2_hmac_sha256_100k"
        }
    }
