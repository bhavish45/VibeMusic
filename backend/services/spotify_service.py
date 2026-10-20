import os
import re
import json
import asyncio
import urllib.parse
import httpx
from typing import Optional, Dict, Any, List
from starlette.concurrency import run_in_threadpool
from services import yt_service
from services.cache_service import get_cache, set_cache

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

async def fetch_spotify_user_playlists(access_token: str, limit: int = 25) -> List[Dict[str, Any]]:
    """
    Fetches the user's playlists from Spotify and grabs their tracks.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
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
            
            # Fetch tracks for this playlist
            tracks = []
            try:
                tracks_resp = await client.get(
                    f"{SPOTIFY_API_BASE}/playlists/{pl_id}/tracks?limit=50",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if tracks_resp.status_code == 200:
                    tracks_data = tracks_resp.json()
                    for t_item in tracks_data.get("items", []):
                        track_obj = t_item.get("track")
                        if not track_obj or not track_obj.get("name"):
                            continue
                        
                        duration_ms = track_obj.get("duration_ms", 0)
                        duration_sec = int(duration_ms / 1000)
                        
                        t_images = track_obj.get("album", {}).get("images", [])
                        poster = t_images[0].get("url") if t_images else None

                        artists = [{"name": a.get("name", "Unknown Artist"), "id": a.get("id")} for a in track_obj.get("artists", [])]
                        if not artists:
                            artists = [{"name": "Unknown Artist"}]

                        sp_track_id = track_obj.get("id") or ""
                        tracks.append({
                            "videoId": f"sp_{sp_track_id}" if sp_track_id else f"sp_{len(tracks)}",
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
            except Exception as e:
                print(f"[Spotify] Error loading tracks for playlist {pl_id}: {e}")

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
                    thumb_hd = thumb.replace("ab67616d00001e02", "ab67616d0000b273")
                    set_cache(cache_key, thumb_hd, expire_seconds=86400 * 30)
                    return thumb_hd
    except Exception:
        pass
    return None

async def import_spotify_playlist_by_url(url_or_id: str) -> Dict[str, Any]:
    """
    Imports any Spotify playlist using public web embed data.
    Requires ZERO API keys, ZERO developer accounts, and is 100% free!
    Fetches each individual track's album cover via Spotify oEmbed.
    """
    clean_input = url_or_id.strip()
    match = re.search(r"playlist[/:]([a-zA-Z0-9]{15,35})", clean_input)
    if match:
        playlist_id = match.group(1)
    elif re.match(r"^[a-zA-Z0-9]{15,35}$", clean_input):
        playlist_id = clean_input
    else:
        raise Exception("Invalid Spotify playlist URL. Please provide a valid link in the format: https://open.spotify.com/playlist/...")

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

        # Fetch each track's individual album poster in parallel via Spotify oEmbed
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
                                # Convert to 640x640 high-resolution cover
                                thumb_hd = thumb.replace("ab67616d00001e02", "ab67616d0000b273")
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

        # Step 2: For any tracks where Spotify oEmbed was missing or 404, resolve artwork via YouTube Music in parallel
        missing_sem = asyncio.Semaphore(8)
        async def resolve_missing(idx: int, t_item: dict):
            if idx < len(track_posters) and track_posters[idx]:
                return track_posters[idx], None
            t_title = t_item.get("title", "")
            t_sub = t_item.get("subtitle", "")
            t_artists = [a.strip() for a in t_sub.replace("\u00a0", " ").split(",") if a.strip()]
            t_art = t_artists[0] if t_artists else ""
            if not t_title:
                return None, None
            async with missing_sem:
                try:
                    match = await resolve_spotify_track_to_youtube(t_title, t_art)
                    if match and match.get("poster"):
                        return match.get("poster"), match.get("videoId")
                except Exception:
                    pass
            return None, None

        missing_resolved = await asyncio.gather(*(resolve_missing(i, t) for i, t in enumerate(track_items)))

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
            
            # Individual track's artwork (Never fall back to the playlist cover)
            individual_poster = track_posters[idx] if idx < len(track_posters) and track_posters[idx] else (missing_resolved[idx][0] if idx < len(missing_resolved) else None)
            resolved_yt_id = missing_resolved[idx][1] if idx < len(missing_resolved) else None
            vid = resolved_yt_id or (f"sp_{sp_id}" if sp_id else f"sp_{idx + 1}")

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

        return {
            "spotify_id": playlist_id,
            "name": name,
            "description": desc,
            "cover_url": cover_url,
            "source": "spotify",
            "tracks": tracks
        }
