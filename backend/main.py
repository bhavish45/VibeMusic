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
                        s_key = f"stream_info:{vid}"
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

# CORS Configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

app.include_router(auth_routes.auth_router, prefix="/api")
app.include_router(auth_routes.user_router, prefix="/api")
app.include_router(auth_routes.spotify_router, prefix="/api")
app.include_router(routes.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "VibeMusic API is running", "status": "healthy"}
