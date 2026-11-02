from fastapi import APIRouter, HTTPException, Request, Query, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from services import yt_service
from services.cache_service import get_cache, set_cache, invalidate_cache
import httpx
import asyncio
import os
import time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

router = APIRouter()

# Shared persistent HTTP client with connection pooling and IPv4 enforcement for reliable streaming
_stream_http_client: httpx.AsyncClient | None = None

def get_stream_client() -> httpx.AsyncClient:
    global _stream_http_client
    if _stream_http_client is None or _stream_http_client.is_closed:
        transport = httpx.AsyncHTTPTransport(
            retries=2,
            verify=False
        )
        _stream_http_client = httpx.AsyncClient(
            transport=transport,
            timeout=httpx.Timeout(connect=10.0, read=45.0, write=15.0, pool=15.0),
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=50, max_connections=100)
        )
    return _stream_http_client

# Singleflight deduplication locks for audio extraction
_extraction_locks: dict[str, asyncio.Lock] = {}
_global_lock = asyncio.Lock()

async def get_video_lock(video_id: str) -> asyncio.Lock:
    async with _global_lock:
        if video_id not in _extraction_locks:
            _extraction_locks[video_id] = asyncio.Lock()
        return _extraction_locks[video_id]


# Helper to warm stream cache in background
async def warm_tracks_cache(tracks: list, quality: str = "high"):
    async def _warm_one(t: dict):
        vid = t.get("videoId")
        if not vid or vid.startswith("sp_"):
            return
        if get_cache(f"stream_info:{vid}:{quality}") or get_cache(f"stream_info:{vid}"):
            return
        lock = await get_video_lock(f"{vid}:{quality}")
        async with lock:
            if get_cache(f"stream_info:{vid}:{quality}") or get_cache(f"stream_info:{vid}"):
                return
            try:
                info = await run_in_threadpool(yt_service.get_audio_stream_info, vid, quality=quality)
                if info and info.get("url"):
                    set_cache(f"stream_info:{vid}:{quality}", info, expire_seconds=14400)
                    set_cache(f"stream_info:{vid}", info, expire_seconds=14400)
            except Exception:
                pass

    tasks = [_warm_one(t) for t in tracks[:6] if isinstance(t, dict)]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)



import re

SAFE_ID_REGEX = re.compile(r'^[a-zA-Z0-9_\-:]{3,80}$')

def validate_safe_id(raw_id: str, label: str = "ID") -> str:
    clean = (raw_id or "").strip()
    if not clean or not SAFE_ID_REGEX.match(clean):
        raise HTTPException(status_code=400, detail=f"Invalid {label} format.")
    return clean

# ====================== SEARCH ======================

@router.get("/search")
def search(q: str = Query(..., min_length=1), filter: str = "songs"):
    clean_q = q[:250].strip()
    cache_key = f"search_v2:{clean_q}:{filter}"
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return cached_result
    
    results = yt_service.search(clean_q, filter_type=filter)
    set_cache(cache_key, results, expire_seconds=7200)
    return results


@router.get("/suggestions")
def suggestions(q: str):
    if not q or not q.strip():
        return []
    clean_q = q[:150].strip()
    cache_key = f"sug:{clean_q}"
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return cached_result
    
    sugs = yt_service.get_search_suggestions(clean_q)
    set_cache(cache_key, sugs, expire_seconds=7200)
    return sugs


@router.get("/album/{browse_id}")
async def get_album_endpoint(browse_id: str):
    safe_browse_id = validate_safe_id(browse_id, "album ID")
    cache_key = f"album_v1:{safe_browse_id}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached
    data = await run_in_threadpool(yt_service.get_album_details, safe_browse_id)
    if data and data.get("tracks"):
        set_cache(cache_key, data, expire_seconds=86400)
    return data


@router.get("/playlist/{browse_id}")
async def get_playlist_endpoint(browse_id: str):
    safe_browse_id = validate_safe_id(browse_id, "playlist ID")
    cache_key = f"playlist_v1:{safe_browse_id}"
    cached = get_cache(cache_key)
    if cached is not None:
        return cached
    data = await run_in_threadpool(yt_service.get_playlist_details, safe_browse_id)
    if data and data.get("tracks"):
        set_cache(cache_key, data, expire_seconds=86400)
    return data


# ====================== HOME & CHARTS ======================

@router.get("/home")
async def get_home(response: Response, background_tasks: BackgroundTasks):
    response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=3600"
    
    cache_key = "home_vibe_popular_sections_v7"
    cached_result = get_cache(cache_key)
    if cached_result:
        # Pre-warm top tracks in background if not already pre-warmed
        top_tracks = cached_result.get("trending") or cached_result.get("tracks") or []
        background_tasks.add_task(warm_tracks_cache, top_tracks)
        return cached_result
    
    data = await run_in_threadpool(yt_service.get_home)
    set_cache(cache_key, data, expire_seconds=3600)
    
    # Warm top tracks in background
    top_tracks = data.get("trending") or data.get("tracks") or []
    background_tasks.add_task(warm_tracks_cache, top_tracks)
    return data


@router.get("/charts")
async def get_charts(country: str = "US", response: Response = None):
    if response:
        response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=7200"
    
    cache_key = f"charts_v2:{country}"
    cached_result = get_cache(cache_key)
    if cached_result:
        return cached_result
    
    data = await run_in_threadpool(yt_service.get_charts, country)
    set_cache(cache_key, data, expire_seconds=3600)
    return data


# ====================== PRELOAD / WARM CACHE ======================

@router.get("/preload/{video_id}")
async def preload_audio(video_id: str, quality: str = "high"):
    """
    Lightweight endpoint to warm the audio stream cache for upcoming queue tracks.
    """
    audio_cache_key = f"stream_info:{video_id}:{quality}"
    if get_cache(audio_cache_key):
        return {"status": "already_cached", "videoId": video_id}

    async def _warm():
        lock = await get_video_lock(f"{video_id}:{quality}")
        async with lock:
            if get_cache(audio_cache_key):
                return
            try:
                info = await run_in_threadpool(yt_service.get_audio_stream_info, video_id, quality=quality)
                if info and info.get("url"):
                    set_cache(audio_cache_key, info, expire_seconds=14400)
                    # Also set quality-less key for fallback compatibility
                    set_cache(f"stream_info:{video_id}", info, expire_seconds=14400)
            except Exception as e:
                print(f"[preload] Failed to preload {video_id}: {e}")

    asyncio.create_task(_warm())
    return {"status": "preloading", "videoId": video_id}


@router.post("/preload-batch")
async def preload_batch(request: Request):
    """
    Preloads multiple tracks in the background for instant transitions in queue.
    Accepts optional 'quality' parameter for quality-aware cache warming.
    """
    try:
        body = await request.json()
        video_ids = body.get("video_ids", [])
        quality = body.get("quality", "high")
    except Exception:
        video_ids = []
        quality = "high"

    async def _warm_all():
        for vid in video_ids[:8]:
            if not vid or vid.startswith("sp_"):
                continue
            key = f"stream_info:{vid}:{quality}"
            fallback_key = f"stream_info:{vid}"
            if not get_cache(key) and not get_cache(fallback_key):
                lock = await get_video_lock(f"{vid}:{quality}")
                async with lock:
                    if not get_cache(key) and not get_cache(fallback_key):
                        try:
                            info = await run_in_threadpool(yt_service.get_audio_stream_info, vid, quality=quality)
                            if info and info.get("url"):
                                set_cache(key, info, expire_seconds=14400)
                                set_cache(fallback_key, info, expire_seconds=14400)
                        except Exception as e:
                            print(f"[preload-batch] Error warming {vid}: {e}")

    asyncio.create_task(_warm_all())
    return {"status": "batch_preloading", "count": len(video_ids)}


# ====================== SONG METADATA ======================

@router.get("/song/{video_id}")
async def get_song(video_id: str):
    cache_key = f"full_song_v2:{video_id}"
    cached_result = get_cache(cache_key)
    if cached_result:
        return cached_result

    try:
        meta = await run_in_threadpool(yt_service.get_song_metadata, video_id)
    except Exception as e:
        print(f"Error fetching metadata for {video_id}: {e}")
        meta = {
            "videoId": video_id,
            "title": "Music Track",
            "artists": [{"name": "Artist"}],
            "duration": 210,
            "poster": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
        }

    result = {
        "videoId": video_id,
        "title": meta.get("title", "Music Track"),
        "artists": meta.get("artists", [{"name": "Artist"}]),
        "duration": meta.get("duration", 210),
        "durationFormatted": meta.get("durationFormatted", "3:30"),
        "thumbnails": meta.get("thumbnails", []),
        "poster": meta.get("poster", ""),
        "fallbackPoster": meta.get("fallbackPoster", f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"),
        "viewCount": meta.get("viewCount", "16,413,738"),
        "description": meta.get("description", "Provided to YouTube by The Orchard Enterprises"),
        "published": meta.get("published", "Jul 2, 2024"),
        "channel": meta.get("channel", "Irokz"),
        "subscribers": meta.get("subscribers", "411K subscribers"),
        "stream_url": f"/api/stream/{video_id}"
    }
    set_cache(cache_key, result, expire_seconds=7200)
    return result


# ====================== LYRICS & RADIO ======================

@router.get("/lyrics/{video_id}")
async def get_lyrics(video_id: str):
    safe_video_id = validate_safe_id(video_id, "video ID")
    cache_key = f"lyrics:{safe_video_id}"
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return cached_result

    data = await run_in_threadpool(yt_service.get_lyrics, safe_video_id)
    result = {"lyrics": data}
    if data:
        set_cache(cache_key, result, expire_seconds=86400)
    return result



@router.get("/artist/{artist_query}")
async def get_artist(
    artist_query: str, 
    browseId: Optional[str] = None, 
    background_tasks: BackgroundTasks = None
):
    clean_q = artist_query[:200].strip()
    safe_browse_id = validate_safe_id(browseId, "artist browse ID") if browseId else None
    cache_key = f"artist_profile_v7:{clean_q.lower()}:{safe_browse_id or ''}"
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        if background_tasks and cached_result.get("songsBrowseId"):
            background_tasks.add_task(run_in_threadpool, yt_service.preload_artist_songs, cached_result["songsBrowseId"])
        return cached_result

    data = await run_in_threadpool(yt_service.get_artist_profile, clean_q, safe_browse_id)
    if data:
        data["isArtist"] = True
        set_cache(cache_key, data, expire_seconds=86400)
        if data.get("browseId"):
            set_cache(f"artist_profile_v7:{clean_q.lower()}:{data['browseId']}", data, expire_seconds=86400)
        if background_tasks and data.get("songsBrowseId"):
            background_tasks.add_task(run_in_threadpool, yt_service.preload_artist_songs, data["songsBrowseId"])
        return data

    no_artist = {"name": None, "isArtist": False, "avatar": "", "subscribers": "", "songs": [], "hasMore": False}
    set_cache(cache_key, no_artist, expire_seconds=3600)
    return no_artist


@router.get("/artist/{artist_query}/more-songs")
async def get_artist_more_songs_endpoint(
    artist_query: str, 
    browseId: Optional[str] = None, 
    offset: int = 0, 
    limit: int = 50
):
    clean_q = artist_query[:200].strip()
    safe_browse_id = validate_safe_id(browseId, "artist browse ID") if browseId else None
    cache_key = f"artist_more_songs_v2:{clean_q.lower()}:{safe_browse_id or ''}:{offset}:{limit}"
    cached_result = get_cache(cache_key)
    if cached_result is not None:
        return cached_result

    data = await run_in_threadpool(
        yt_service.get_artist_more_songs, 
        clean_q, 
        safe_browse_id, 
        offset, 
        limit
    )
    if data:
        set_cache(cache_key, data, expire_seconds=86400)
        return data
    return {"tracks": [], "offset": offset, "total": 0, "hasMore": False}


@router.get("/radio/{video_id}")
async def get_radio(video_id: str):
    safe_video_id = validate_safe_id(video_id, "video ID")
    cache_key = f"radio:{safe_video_id}"
    cached_result = get_cache(cache_key)
    if cached_result:
        return cached_result
    
    data = await run_in_threadpool(yt_service.get_watch_playlist, safe_video_id)
    if data and data.get("tracks"):
        set_cache(cache_key, data, expire_seconds=7200)
    return data


# ====================== STREAM PROXY ======================

@router.get("/test-stream/{video_id}")
async def test_stream(video_id: str):
    """Diagnostic endpoint to verify audio stream extraction on Render."""
    safe_id = validate_safe_id(video_id, "video ID")
    start_time = time.time()
    cookie_env = bool(os.getenv("YOUTUBE_COOKIES"))
    cookie_path = yt_service.get_cookie_file_path()

    diagnostic = {
        "videoId": safe_id,
        "cookie_env_set": cookie_env,
        "cookie_file_path": cookie_path,
        "cookie_file_exists": bool(cookie_path and os.path.exists(cookie_path)),
        "cookie_file_bytes": os.path.getsize(cookie_path) if cookie_path and os.path.exists(cookie_path) else 0,
    }

    try:
        info = await asyncio.wait_for(
            run_in_threadpool(yt_service.get_audio_stream_info, safe_id),
            timeout=20.0
        )
        diagnostic["status"] = "success"
        diagnostic["title"] = info.get("title")
        diagnostic["bitrate"] = info.get("bitrate")
        diagnostic["client"] = info.get("client")
        diagnostic["url_preview"] = info.get("url", "")[:80] + "..." if info.get("url") else None
        diagnostic["elapsed_seconds"] = round(time.time() - start_time, 2)
        return diagnostic
    except asyncio.TimeoutError:
        diagnostic["status"] = "timeout"
        diagnostic["error"] = "Extraction exceeded 20 second safety limit"
        diagnostic["elapsed_seconds"] = round(time.time() - start_time, 2)
        return diagnostic
    except Exception as e:
        diagnostic["status"] = "error"
        diagnostic["error"] = str(e)
        diagnostic["elapsed_seconds"] = round(time.time() - start_time, 2)
        return diagnostic

@router.get("/stream/{video_id}")
async def stream_audio(video_id: str, request: Request, retry: int = 0, quality: str = "high"):
    """
    Proxies audio stream with HTTP Range support for instant, zero-delay playback.
    Singleflight deduplication + connection pooling + automatic 403/410 recovery.
    Supports bitrate quality selection: high (320k), standard (160k), saver (96k).
    """
    video_id = validate_safe_id(video_id, "video ID")
    if video_id.startswith("sp_"):
        clean_sp = video_id.replace("sp_", "").strip()
        try:
            from services import spotify_service
            client = get_stream_client()
            oembed_url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{clean_sp}"
            oe = await client.get(oembed_url)
            if oe.status_code == 200:
                oe_title = oe.json().get("title", "")
                resolved = await spotify_service.resolve_spotify_track_to_youtube(oe_title, "")
                if resolved and resolved.get("videoId"):
                    video_id = resolved["videoId"]
        except Exception as e:
            print(f"[stream] Failed to resolve sp_ id {video_id}: {e}")

    audio_cache_key = f"stream_info:{video_id}:{quality}"
    cached_info = None if retry > 0 else get_cache(audio_cache_key)
    
    if not cached_info:
        # Use per-video singleflight lock to prevent concurrent duplicate extractions
        lock = await get_video_lock(f"{video_id}:{quality}")
        async with lock:
            cached_info = get_cache(audio_cache_key)
            if not cached_info or retry > 0:
                try:
                    cached_info = await run_in_threadpool(yt_service.get_audio_stream_info, video_id, quality=quality)
                    if cached_info and cached_info.get("url"):
                        set_cache(audio_cache_key, cached_info, expire_seconds=14400)
                except Exception as e:
                    print(f"Failed to extract audio stream for {video_id} ({quality}): {e}")
                    raise HTTPException(status_code=500, detail="Could not extract audio stream")
            
    if not cached_info or not cached_info.get("url"):
        raise HTTPException(status_code=404, detail="Audio stream not found")

    target_url = cached_info["url"]
    headers = dict(cached_info.get("headers", {}))
    
    client_range = request.headers.get("Range")
    if client_range:
        headers["Range"] = client_range
    else:
        headers["Range"] = "bytes=0-"

    headers.setdefault("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
    headers.setdefault("Accept", "*/*")
    headers.setdefault("Accept-Language", "en-US,en;q=0.9")

    client = get_stream_client()
    try:
        remote_req = client.build_request("GET", target_url, headers=headers)
        remote_res = await client.send(remote_req, stream=True)
        
        # If upstream gave 403 or 410 (expired Google CDN token), refresh extraction once
        if remote_res.status_code in (403, 410):
            await remote_res.aclose()
            print(f"Upstream returned {remote_res.status_code} for {video_id}. Re-extracting fresh audio stream...")
            invalidate_cache(audio_cache_key)
            
            fresh_info = await run_in_threadpool(yt_service.get_audio_stream_info, video_id, quality=quality)
            if fresh_info and fresh_info.get("url"):
                set_cache(audio_cache_key, fresh_info, expire_seconds=14400)
                target_url = fresh_info["url"]
                headers = dict(fresh_info.get("headers", {}))
                headers["Range"] = client_range or "bytes=0-"
                remote_req = client.build_request("GET", target_url, headers=headers)
                remote_res = await client.send(remote_req, stream=True)

    except Exception as e:
        print(f"Error connecting to stream target for {video_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to connect to upstream audio stream")

    async def stream_generator():
        try:
            async for chunk in remote_res.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await remote_res.aclose()

    resp_headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": remote_res.headers.get("Content-Type", "audio/mp4"),
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    }
    if "Content-Range" in remote_res.headers:
        resp_headers["Content-Range"] = remote_res.headers["Content-Range"]
    if "Content-Length" in remote_res.headers:
        resp_headers["Content-Length"] = remote_res.headers["Content-Length"]

    return StreamingResponse(
        stream_generator(),
        status_code=remote_res.status_code,
        headers=resp_headers
    )


# ====================== AUDIO DOWNLOAD ======================

@router.get("/download/{video_id}")
async def download_audio(
    video_id: str,
    request: Request,
    filename: Optional[str] = None,
    quality: str = "high"
):
    """
    Direct audio download endpoint that forces a file download dialog in the user's browser,
    saving the song to the user's drive with 'songname.extension'.
    """
    video_id = validate_safe_id(video_id, "video ID")
    if video_id.startswith("sp_"):
        clean_sp = video_id.replace("sp_", "").strip()
        try:
            from services import spotify_service
            client = get_stream_client()
            oembed_url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{clean_sp}"
            oe = await client.get(oembed_url)
            if oe.status_code == 200:
                oe_title = oe.json().get("title", "")
                resolved = await spotify_service.resolve_spotify_track_to_youtube(oe_title, "")
                if resolved and resolved.get("videoId"):
                    video_id = resolved["videoId"]
        except Exception as e:
            print(f"[download] Failed to resolve sp_ id {video_id}: {e}")

    audio_cache_key = f"stream_info:{video_id}:{quality}"
    cached_info = get_cache(audio_cache_key)

    if not cached_info:
        lock = await get_video_lock(f"{video_id}:{quality}")
        async with lock:
            cached_info = get_cache(audio_cache_key)
            if not cached_info:
                try:
                    cached_info = await run_in_threadpool(yt_service.get_audio_stream_info, video_id, quality=quality)
                    if cached_info and cached_info.get("url"):
                        set_cache(audio_cache_key, cached_info, expire_seconds=14400)
                except Exception as e:
                    print(f"Failed to extract audio stream for download {video_id} ({quality}): {e}")
                    raise HTTPException(status_code=500, detail="Could not extract audio stream for download")

    if not cached_info or not cached_info.get("url"):
        raise HTTPException(status_code=404, detail="Audio stream not found")

    target_url = cached_info["url"]
    headers = dict(cached_info.get("headers", {}))
    headers.setdefault("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
    headers.setdefault("Accept", "*/*")

    # Determine extension and format clean filename
    raw_ext = (cached_info.get("ext") or "m4a").lower()
    ext = "m4a" if raw_ext in ("mp4", "m4a") else raw_ext

    if filename:
        clean_name = filename.strip()
    else:
        title = cached_info.get("title") or f"song_{video_id}"
        clean_name = f"{title}.{ext}"

    # Remove illegal filesystem characters and normalize spaces
    import re
    from urllib.parse import quote
    clean_name = re.sub(r'[\/\\?%*:|"<>;\r\n]', "", clean_name)
    clean_name = re.sub(r'\s+', " ", clean_name).strip().rstrip('.')
    if not clean_name:
        clean_name = f"song_{video_id}.{ext}"

    if not any(clean_name.lower().endswith(f".{e}") for e in ("m4a", "mp3", "webm", "ogg", "wav", "mp4")):
        clean_name = f"{clean_name}.{ext}"

    ascii_name = re.sub(r'[^\x20-\x7E]', '_', clean_name)
    encoded_name = quote(clean_name, encoding="utf-8")
    content_disposition = f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{encoded_name}'

    client = get_stream_client()
    try:
        remote_req = client.build_request("GET", target_url, headers=headers)
        remote_res = await client.send(remote_req, stream=True)

        if remote_res.status_code in (403, 410):
            await remote_res.aclose()
            invalidate_cache(audio_cache_key)
            fresh_info = await run_in_threadpool(yt_service.get_audio_stream_info, video_id, quality=quality)
            if fresh_info and fresh_info.get("url"):
                set_cache(audio_cache_key, fresh_info, expire_seconds=14400)
                target_url = fresh_info["url"]
                headers = dict(fresh_info.get("headers", {}))
                remote_req = client.build_request("GET", target_url, headers=headers)
                remote_res = await client.send(remote_req, stream=True)
    except Exception as e:
        print(f"Error connecting to download stream for {video_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to connect to audio download stream")

    async def stream_generator():
        try:
            async for chunk in remote_res.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await remote_res.aclose()

    mime_type = "audio/mp4" if ext == "m4a" else ("audio/webm" if ext == "webm" else (remote_res.headers.get("Content-Type") or "audio/mp4"))
    resp_headers = {
        "Content-Type": mime_type,
        "Content-Disposition": content_disposition,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Length",
    }
    if "Content-Length" in remote_res.headers:
        resp_headers["Content-Length"] = remote_res.headers["Content-Length"]

    return StreamingResponse(
        stream_generator(),
        status_code=remote_res.status_code,
        headers=resp_headers
    )
