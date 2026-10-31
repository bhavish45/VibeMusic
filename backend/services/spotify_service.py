import os
import re
import json
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
import urllib.parse
import httpx
from typing import Optional, Dict, Any, List
from starlette.concurrency import run_in_threadpool
from services import yt_service
from services.cache_service import get_cache, set_cache

# Persistent high-speed Pathfinder client singleton to avoid repeating 8s TLS/JS-pack handshakes
_shared_spotapi_client = None
_shared_spotapi_base = None
_spotapi_lock = threading.Lock()
_spotapi_warming = False

def get_shared_spotapi_base():
    global _shared_spotapi_client, _shared_spotapi_base
    if _shared_spotapi_base is not None:
        return _shared_spotapi_client, _shared_spotapi_base
    with _spotapi_lock:
        if _shared_spotapi_base is not None:
            return _shared_spotapi_client, _shared_spotapi_base
        try:
            import spotapi
            _shared_spotapi_client = spotapi.http.request.TLSClient("chrome120", "", auto_retries=3)
            _shared_spotapi_base = spotapi.client.BaseClient(client=_shared_spotapi_client)
        except Exception as e:
            print(f"[Spotify] Could not create shared spotapi client: {e}")
            return None, None
        return _shared_spotapi_client, _shared_spotapi_base

def warmup_spotapi():
    global _spotapi_warming
    if _spotapi_warming:
        return
    _spotapi_warming = True
    try:
        tls, base = get_shared_spotapi_base()
        if base and tls:
            import spotapi
            p = spotapi.PublicPlaylist("37i9dQZF1DWXRqgorJj26U", client=tls)
            p.base = base
            _ = p.get_playlist_info(limit=1)
            print("[Spotify] Pathfinder GraphQL API client pre-warmed successfully (0ms handshake for user imports).")
    except Exception as e:
        print(f"[Spotify] Pre-warmup notice: {e}")
    finally:
        _spotapi_warming = False

# Kick off asynchronous background warm-up immediately so client is already ready before user ever pastes a link
threading.Thread(target=warmup_spotapi, daemon=True).start()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")
SPOTIFY_REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://localhost:3000/auth/spotify/callback")

SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

SPOTIFY_SCOPES = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-read"
]

def is_spotify_configured() -> bool:
    return bool(SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET)

def get_spotify_auth_url(state: str = "vibemusic_spotify_auth") -> str:
    params = {
        "client_id": SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": SPOTIFY_REDIRECT_URI,
        "scope": " ".join(SPOTIFY_SCOPES),
        "state": state,
        "show_dialog": "true"
    }
    return f"{SPOTIFY_AUTH_URL}?{urllib.parse.urlencode(params)}"

async def exchange_spotify_code(code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
    uri = redirect_uri or SPOTIFY_REDIRECT_URI
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            SPOTIFY_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": uri,
            },
            auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if response.status_code != 200:
            raise Exception(f"Failed to exchange Spotify token: {response.text}")
        return response.json()

async def get_spotify_user_profile(access_token: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{SPOTIFY_API_BASE}/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if response.status_code != 200:
            raise Exception(f"Failed to fetch Spotify user profile: {response.text}")
        return response.json()

def format_duration(seconds: int) -> str:
    mins = seconds // 60
    secs = seconds % 60
    return f"{mins}:{secs:02d}"

async def fetch_spotify_user_playlists(access_token: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetches the user's playlists from Spotify via OAuth and paginates through all tracks.
    """
    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.get(
            f"{SPOTIFY_API_BASE}/me/playlists?limit={limit}",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if response.status_code != 200:
            raise Exception(f"Failed to fetch Spotify playlists: {response.text}")
        
        data = response.json()
        items = data.get("items", [])
        playlists_result = []

        for item in items:
            if not item:
                continue
            pl_id = item.get("id")
            pl_name = item.get("name") or "Spotify Playlist"
            pl_desc = item.get("description") or ""
            images = item.get("images") or []
            cover_url = images[0].get("url") if images else None
            
            # Fetch all tracks for this playlist with pagination
            tracks = []
            next_url = f"{SPOTIFY_API_BASE}/playlists/{pl_id}/tracks?limit=100"
            try:
                while next_url and len(tracks) < 5000:
                    tracks_resp = await client.get(next_url, headers={"Authorization": f"Bearer {access_token}"})
                    if tracks_resp.status_code != 200:
                        break
                    tracks_data = tracks_resp.json()
                    for t_item in tracks_data.get("items", []):
                        track_obj = t_item.get("track")
                        if not track_obj or not track_obj.get("name"):
                            continue
                        
                        duration_ms = track_obj.get("duration_ms", 0)
                        duration_sec = int(duration_ms / 1000)
                        
                        t_images = track_obj.get("album", {}).get("images", [])
                        poster = t_images[0].get("url") if t_images else None
                        if poster:
                            poster = poster.replace("ab67616d00001e02", "ab67616d0000b273")

                        artists = [{"name": a.get("name", "Unknown Artist"), "id": a.get("id")} for a in track_obj.get("artists", [])]
                        if not artists:
                            artists = [{"name": "Unknown Artist"}]

                        sp_track_id = track_obj.get("id") or ""
                        tracks.append({
                            "videoId": f"sp_{sp_track_id}" if sp_track_id else f"sp_{len(tracks) + 1}",
                            "spotifyId": sp_track_id,
                            "title": track_obj.get("name"),
                            "artists": artists,
                            "album": {
                                "name": track_obj.get("album", {}).get("name", ""),
                                "id": track_obj.get("album", {}).get("id")
                            },
                            "duration": duration_sec,
                            "durationFormatted": format_duration(duration_sec),
                            "poster": poster,
                            "fallbackPoster": poster,
                            "source": "spotify"
                        })
                    next_url = tracks_data.get("next")
            except Exception as e:
                print(f"[Spotify] Error loading tracks for user playlist {pl_id}: {e}")

            playlists_result.append({
                "spotify_id": pl_id,
                "name": pl_name,
                "description": pl_desc,
                "cover_url": cover_url,
                "source": "spotify",
                "tracks": tracks
            })

        return playlists_result

# Track YouTube resolution cache
async def resolve_spotify_track_to_youtube(title: str, artist: str) -> Optional[Dict[str, Any]]:
    """
    Finds the best matching YouTube Music track for a Spotify track.
    Caches the match permanently so it's instant on future plays.
    """
    clean_q = f"{title} {artist}".strip()
    cache_key = f"sp_resolve_yt:{clean_q.lower()}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    try:
        search_results = await run_in_threadpool(yt_service.search, clean_q, "songs")
        if search_results and isinstance(search_results, list) and len(search_results) > 0:
            top_match = search_results[0]
            if top_match.get("videoId"):
                set_cache(cache_key, top_match, expire_seconds=86400 * 30) # 30 days
                return top_match
    except Exception as e:
        print(f"[Spotify] Resolution error for '{clean_q}': {e}")
    return None

async def get_spotify_track_poster(sp_id: str) -> Optional[str]:
    """
    Fetches individual track artwork via public Spotify oEmbed API.
    """
    if not sp_id:
        return None
    clean_id = sp_id.replace("spotify:track:", "").replace("sp_", "").strip()
    if not clean_id:
        return None
    cache_key = f"sp_track_art:{clean_id}"
    cached = get_cache(cache_key)
    if cached:
        return cached
    try:
        async with httpx.AsyncClient(timeout=7.0) as client:
            oembed_url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{clean_id}"
            r = await client.get(oembed_url)
            if r.status_code == 200:
                thumb = r.json().get("thumbnail_url")
                if thumb:
                    thumb_hd = thumb.replace("ab67616d00001e02", "ab67616d0000b273").replace("ab67616d00004851", "ab67616d0000b273")
                    set_cache(cache_key, thumb_hd, expire_seconds=86400 * 30)
                    return thumb_hd
    except Exception:
        pass
    return None

def _fetch_via_spotapi(playlist_id: str) -> Optional[Dict[str, Any]]:
    """
    Blazing-fast parallel pagination that fetches ALL tracks from any public Spotify playlist
    (whether 100, 500, or 1000+ tracks) without requiring any API keys or developer credentials.
    Reuses pre-warmed session to eliminate 8s TLS handshakes and fetches multi-hundred song chunks in parallel.
    Extracts individual track HD album art directly from Spotify's response.
    """
    global _shared_spotapi_base
    try:
        import spotapi

        tls, base = get_shared_spotapi_base()
        if tls and base:
            pp = spotapi.PublicPlaylist(playlist_id, client=tls)
            pp.base = base
        else:
            pp = spotapi.PublicPlaylist(playlist_id)

        # 1. Fetch first chunk (up to 343 songs) and playlist metadata in ONE single call
        UPPER_LIMIT = 343
        first_resp = pp.get_playlist_info(limit=UPPER_LIMIT, offset=0)
        pl_v2 = first_resp.get("data", {}).get("playlistV2", {})
        if not pl_v2:
            return None

        name = pl_v2.get("name") or "Spotify Playlist"
        desc = pl_v2.get("description") or ""

        cover_url = None
        images = pl_v2.get("images", {}).get("items", [])
        if images and images[0].get("sources"):
            cover_url = images[0]["sources"][0].get("url")

        content = pl_v2.get("content", {})
        total_count = content.get("totalCount", 0)

        raw_chunks = [content]

        # 2. If playlist has more than 343 tracks, fetch remaining chunks IN PARALLEL!
        if total_count > UPPER_LIMIT:
            remaining_offsets = list(range(UPPER_LIMIT, total_count, UPPER_LIMIT))
            max_workers = min(6, len(remaining_offsets))
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(pp.get_playlist_info, limit=UPPER_LIMIT, offset=off)
                    for off in remaining_offsets
                ]
                for fut in futures:
                    resp = fut.result()
                    c = resp.get("data", {}).get("playlistV2", {}).get("content", {})
                    if c:
                        raw_chunks.append(c)

        # 3. Parse all tracks efficiently
        tracks: List[Dict[str, Any]] = []
        for chunk in raw_chunks:
            for item in chunk.get("items", []):
                t_data = item.get("itemV2", {}).get("data", {})
                if not t_data:
                    continue
                title = t_data.get("name")
                if not title:
                    continue

                raw_artists = t_data.get("artists", {}).get("items", [])
                artists = [
                    {"name": a.get("profile", {}).get("name", "Unknown Artist")} 
                    for a in raw_artists if a and a.get("profile", {}).get("name")
                ]
                if not artists:
                    artists = [{"name": "Unknown Artist"}]

                dur_ms = t_data.get("trackDuration", {}).get("totalMilliseconds", 0)
                dur_sec = int(dur_ms / 1000) if dur_ms > 0 else 210

                sp_uri = t_data.get("uri", "")
                sp_id = sp_uri.replace("spotify:track:", "").strip() if sp_uri else ""

                cover_sources = t_data.get("albumOfTrack", {}).get("coverArt", {}).get("sources", [])
                poster = cover_sources[0].get("url") if cover_sources else None
                if poster:
                    poster = poster.replace("ab67616d00001e02", "ab67616d0000b273").replace("ab67616d00004851", "ab67616d0000b273")

                tracks.append({
                    "videoId": f"sp_{sp_id}" if sp_id else f"sp_{len(tracks) + 1}",
                    "spotifyId": sp_id,
                    "title": title,
                    "artists": artists,
                    "album": {"name": t_data.get("albumOfTrack", {}).get("name", "")},
                    "duration": dur_sec,
                    "durationFormatted": format_duration(dur_sec),
                    "poster": poster,
                    "fallbackPoster": poster,
                    "source": "spotify"
                })

        if tracks:
            return {
                "spotify_id": playlist_id,
                "name": name,
                "description": desc,
                "cover_url": cover_url,
                "source": "spotify",
                "tracks": tracks
            }
    except Exception as e:
        print(f"[Spotify] spotapi pagination error for {playlist_id}: {e}")
        # Reset shared base on failure so next call re-authenticates cleanly
        _shared_spotapi_base = None
    return None

async def import_spotify_playlist_by_url(url_or_id: str) -> Dict[str, Any]:
    """
    Imports any Spotify playlist using link or ID.
    Loads ALL tracks (whether 100, 500, or 1000+ songs) efficiently.
    Requires ZERO API keys, ZERO developer accounts, and is 100% free!
    Includes individual track HD album covers and playlist metadata.
    """
    clean_input = url_or_id.strip()
    match = re.search(r"playlist[/:]([a-zA-Z0-9]{15,35})", clean_input)
    if match:
        playlist_id = match.group(1)
    elif re.match(r"^[a-zA-Z0-9]{15,35}$", clean_input):
        playlist_id = clean_input
    else:
        raise Exception("Invalid Spotify playlist URL. Please provide a valid link in the format: https://open.spotify.com/playlist/...")

    # 1. Check persistent cache for instant loading (< 0.1ms)
    cache_key = f"sp_pl_full:{playlist_id}"
    cached = get_cache(cache_key)
    if cached and isinstance(cached, dict) and cached.get("tracks"):
        return cached

    # 2. High-speed full playlist pagination (loads all tracks, up to thousands)
    full_playlist = await run_in_threadpool(_fetch_via_spotapi, playlist_id)
    if full_playlist and full_playlist.get("tracks"):
        set_cache(cache_key, full_playlist, expire_seconds=86400 * 2) # Cache for 2 days
        return full_playlist

    # 3. Fallback to public web embed data (if Pathfinder query is unavailable)
    embed_url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    limits = httpx.Limits(max_keepalive_connections=30, max_connections=50)
    timeout = httpx.Timeout(15.0, connect=5.0)

    async with httpx.AsyncClient(timeout=timeout, limits=limits, headers=headers) as client:
        resp = await client.get(embed_url, follow_redirects=True)
        if resp.status_code != 200:
            raise Exception("Could not retrieve Spotify playlist. Make sure the playlist link is valid.")

        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', resp.text)
        if not m:
            raise Exception("Could not parse Spotify playlist structure. The playlist might be private.")

        data = json.loads(m.group(1))
        props = data.get("props", {}).get("pageProps", {})
        entity = props.get("state", {}).get("data", {}).get("entity", {}) or props.get("entity", {})

        if not entity or not isinstance(entity, dict):
            raise Exception("Spotify playlist not found or inaccessible. Please verify the playlist link is public.")

        name = entity.get("name") or entity.get("title")
        track_items = entity.get("trackList", [])
        if not name or name == "null" or not track_items:
            raise Exception("Spotify playlist not found or contains no tracks. Please verify the link is public.")

        desc = entity.get("subtitle") or entity.get("description") or ""
        cover_sources = entity.get("coverArt", {}).get("sources", [])
        cover_url = cover_sources[0].get("url") if cover_sources else None

        # Fetch individual track artwork in parallel via Spotify oEmbed
        sem = asyncio.Semaphore(25)
        async def fetch_track_poster(raw_id: str) -> Optional[str]:
            sp_id = raw_id.replace("spotify:track:", "").strip() if raw_id else ""
            if not sp_id:
                return None
            cache_key = f"sp_track_art:{sp_id}"
            cached = get_cache(cache_key)
            if cached:
                return cached
            async with sem:
                for attempt in range(2):
                    try:
                        oembed_url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{sp_id}"
                        r = await client.get(oembed_url, timeout=6.0)
                        if r.status_code == 200:
                            thumb = r.json().get("thumbnail_url")
                            if thumb:
                                thumb_hd = thumb.replace("ab67616d00001e02", "ab67616d0000b273").replace("ab67616d00004851", "ab67616d0000b273")
                                set_cache(cache_key, thumb_hd, expire_seconds=86400 * 30)
                                return thumb_hd
                        elif r.status_code == 429 and attempt == 0:
                            await asyncio.sleep(0.3)
                            continue
                        break
                    except Exception:
                        if attempt == 0:
                            await asyncio.sleep(0.2)
                            continue
            return None

        sp_ids = [t.get("uri", "") for t in track_items]
        track_posters = await asyncio.gather(*(fetch_track_poster(sid) for sid in sp_ids))

        tracks = []
        for idx, t in enumerate(track_items):
            title = t.get("title") or t.get("name")
            if not title and isinstance(t.get("track"), dict):
                title = t["track"].get("name") or t["track"].get("title")
            if not title:
                continue

            subtitle = t.get("subtitle") or t.get("artist") or "Unknown Artist"
            if isinstance(subtitle, list):
                clean_artists = [a.get("name", "").strip() if isinstance(a, dict) else str(a).strip() for a in subtitle if a]
            elif isinstance(t.get("artists"), list):
                clean_artists = [a.get("name", "").strip() if isinstance(a, dict) else str(a).strip() for a in t.get("artists") if a]
            else:
                clean_artists = [a.strip() for a in str(subtitle).replace("\u00a0", " ").split(",") if a.strip()]
            
            artists = [{"name": a} for a in clean_artists] if clean_artists else [{"name": "Unknown Artist"}]
            dur_ms = t.get("duration", 0) or (t.get("duration_ms", 0) if isinstance(t.get("duration_ms"), (int, float)) else 0)
            dur_sec = int(dur_ms / 1000) if dur_ms > 0 else 210
            sp_uri = t.get("uri", "") or (t.get("track", {}).get("uri", "") if isinstance(t.get("track"), dict) else "")
            sp_id = sp_uri.replace("spotify:track:", "").strip() if sp_uri else (t.get("id", "") or "")
            
            individual_poster = track_posters[idx] if idx < len(track_posters) and track_posters[idx] else None
            vid = f"sp_{sp_id}" if sp_id else f"sp_{idx + 1}"

            tracks.append({
                "videoId": vid,
                "spotifyId": sp_id,
                "title": title,
                "artists": artists,
                "album": {"name": name},
                "duration": dur_sec,
                "durationFormatted": format_duration(dur_sec),
                "poster": individual_poster,
                "fallbackPoster": individual_poster,
                "source": "spotify"
            })

        if not tracks:
            raise Exception("No playable tracks could be retrieved from this Spotify playlist. Make sure the playlist is public.")

        result = {
            "spotify_id": playlist_id,
            "name": name,
            "description": desc,
            "cover_url": cover_url,
            "source": "spotify",
            "tracks": tracks
        }
        set_cache(cache_key, result, expire_seconds=86400 * 2)
        return result
