import os
import time
import json
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

_supabase_client = None

def get_supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "")

def get_supabase_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")

def is_supabase_configured() -> bool:
    url = get_supabase_url()
    key = get_supabase_key()
    return bool(
        url and 
        key and 
        url.startswith("https://") and 
        "your-project-id" not in url
    )

def get_supabase_client(user_token: Optional[str] = None):
    global _supabase_client
    if not is_supabase_configured():
        return None

    # 1. If SERVICE_ROLE_KEY is configured, it bypasses RLS on all operations
    service_role_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if service_role_key:
        if _supabase_client is None:
            try:
                from supabase import create_client
                url = get_supabase_url()
                _supabase_client = create_client(url, service_role_key)
                print("[Supabase] Connected to Supabase with Service Role Admin key (RLS bypassed).")
            except Exception as e:
                print(f"[Supabase] Warning: Could not initialize service role client: {e}")
        if _supabase_client:
            return _supabase_client

    # 2. If user_token is passed, scope PostgREST headers with user's JWT so auth.uid() == user_id in RLS
    if user_token:
        try:
            from supabase import create_client, ClientOptions
            url = get_supabase_url()
            anon_key = os.getenv("SUPABASE_ANON_KEY", "")
            opts = ClientOptions(headers={"Authorization": f"Bearer {user_token}"})
            return create_client(url, anon_key, options=opts)
        except Exception as e:
            print(f"[Supabase] Error creating user-scoped client: {e}")

    # 3. Fallback to singleton anon client
    if _supabase_client is None:
        try:
            from supabase import create_client
            url = get_supabase_url()
            anon_key = os.getenv("SUPABASE_ANON_KEY", "")
            _supabase_client = create_client(url, anon_key)
            print("[Supabase] Connected to Supabase Cloud PostgreSQL database.")
        except Exception as e:
            print(f"[Supabase] Warning: Could not initialize Supabase client: {e}")
            return None
    return _supabase_client

# ----------------- FAVORITES (Supabase Cloud PostgreSQL) -----------------

def get_user_favorites(user_id: str, user_token: Optional[str] = None) -> List[Dict[str, Any]]:
    client = get_supabase_client(user_token)
    if not client:
        return []
    try:
        res = client.table("user_favorites")\
            .select("track_json")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        favs = []
        for row in (res.data or []):
            t_json = row.get("track_json")
            if isinstance(t_json, str):
                try:
                    favs.append(json.loads(t_json))
                except Exception:
                    pass
            elif isinstance(t_json, dict):
                favs.append(t_json)
        return favs
    except Exception as e:
        print(f"[Supabase] Error fetching favorites: {e}")
        return []

def add_user_favorite(user_id: str, track: Dict[str, Any], user_token: Optional[str] = None) -> bool:
    client = get_supabase_client(user_token)
    if not client:
        return False
    video_id = track.get("videoId")
    if not video_id:
        return False
    now = int(time.time())
    try:
        client.table("user_favorites").upsert({
            "user_id": user_id,
            "video_id": video_id,
            "track_json": track,
            "created_at": now
        }, on_conflict="user_id,video_id").execute()
        return True
    except Exception as e:
        print(f"[Supabase] Error adding favorite: {e}")
        return False

def remove_user_favorite(user_id: str, video_id: str, user_token: Optional[str] = None) -> bool:
    client = get_supabase_client(user_token)
    if not client:
        return False
    try:
        client.table("user_favorites")\
            .delete()\
            .eq("user_id", user_id)\
            .eq("video_id", video_id)\
            .execute()
        return True
    except Exception as e:
        print(f"[Supabase] Error removing favorite: {e}")
        return False

# ----------------- PLAYLISTS (Supabase Cloud PostgreSQL) -----------------

def get_user_playlists(user_id: str, user_token: Optional[str] = None) -> List[Dict[str, Any]]:
    client = get_supabase_client(user_token)
    if not client:
        return []
    try:
        pl_res = client.table("user_playlists")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        
        playlists = []
        for p in (pl_res.data or []):
            # Fetch tracks (for custom playlists)
            if p.get("source") == "spotify":
                p["tracks"] = []
                playlists.append(p)
                continue

            tr_res = client.table("user_playlist_tracks")\
                .select("track_json")\
                .eq("playlist_id", p["id"])\
                .order("position", desc=False)\
                .order("created_at", desc=False)\
                .execute()
            tracks = []
            for tr in (tr_res.data or []):
                t_json = tr.get("track_json")
                if isinstance(t_json, str):
                    try:
                        tracks.append(json.loads(t_json))
                    except Exception:
                        pass
                elif isinstance(t_json, dict):
                    tracks.append(t_json)
            p["tracks"] = tracks
            playlists.append(p)
        return playlists
    except Exception as e:
        print(f"[Supabase] Error fetching playlists: {e}")
        return []

def get_playlist_by_id(playlist_id: str, user_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    client = get_supabase_client(user_token)
    if not client:
        return None
    try:
        res = client.table("user_playlists").select("*").eq("id", playlist_id).execute()
        if not res.data:
            return None
        p = res.data[0]
        if p.get("source") == "spotify":
            p["tracks"] = []
            return p

        tr_res = client.table("user_playlist_tracks")\
            .select("track_json")\
            .eq("playlist_id", playlist_id)\
            .order("position", desc=False)\
            .order("created_at", desc=False)\
            .execute()
        tracks = []
        for tr in (tr_res.data or []):
            t_json = tr.get("track_json")
            if isinstance(t_json, str):
                try:
                    tracks.append(json.loads(t_json))
                except Exception:
                    pass
            elif isinstance(t_json, dict):
                tracks.append(t_json)
        p["tracks"] = tracks
        return p
    except Exception as e:
        print(f"[Supabase] Error fetching playlist by id: {e}")
        return None

def create_user_playlist(
    user_id: str,
    name: str,
    description: Optional[str] = None,
    cover_url: Optional[str] = None,
    source: str = "custom",
    spotify_playlist_id: Optional[str] = None,
    tracks: Optional[List[Dict[str, Any]]] = None,
    playlist_id: Optional[str] = None,
    user_token: Optional[str] = None
) -> Dict[str, Any]:
    client = get_supabase_client(user_token)
    if not client:
        return {}
    if not playlist_id:
        import uuid
        playlist_id = f"pl_{uuid.uuid4().hex[:12]}"
    now = int(time.time())
    try:
        pl_data = {
            "id": playlist_id,
            "user_id": user_id,
            "name": name.strip(),
            "description": description or "",
            "cover_url": cover_url,
            "source": source,
            "spotify_playlist_id": spotify_playlist_id,
            "created_at": now,
            "updated_at": now
        }
        client.table("user_playlists").insert(pl_data).execute()

        saved_tracks = []
        if tracks and source != "spotify":
            for idx, track in enumerate(tracks):
                vid = track.get("videoId") or f"sp_{idx}"
                track["videoId"] = vid
                client.table("user_playlist_tracks").insert({
                    "playlist_id": playlist_id,
                    "video_id": vid,
                    "track_json": track,
                    "position": idx,
                    "created_at": now
                }).execute()
                saved_tracks.append(track)
        
        pl_data["tracks"] = saved_tracks
        return pl_data
    except Exception as e:
        print(f"[Supabase] Error creating playlist: {e}")
        return {}

def delete_user_playlist(user_id: str, playlist_id: str, user_token: Optional[str] = None) -> bool:
    client = get_supabase_client(user_token)
    if not client:
        return False
    try:
        client.table("user_playlists")\
            .delete()\
            .eq("id", playlist_id)\
            .eq("user_id", user_id)\
            .execute()
        return True
    except Exception as e:
        print(f"[Supabase] Error deleting playlist: {e}")
        return False

def add_track_to_playlist(playlist_id: str, track: Dict[str, Any], user_token: Optional[str] = None) -> bool:
    client = get_supabase_client(user_token)
    if not client:
        return False
    video_id = track.get("videoId")
    if not video_id:
        return False
    now = int(time.time())
    try:
        client.table("user_playlist_tracks").upsert({
            "playlist_id": playlist_id,
            "video_id": video_id,
            "track_json": track,
            "created_at": now
        }, on_conflict="playlist_id,video_id").execute()
        return True
    except Exception as e:
        print(f"[Supabase] Error adding track to playlist: {e}")
        return False

def remove_track_from_playlist(playlist_id: str, video_id: str, user_token: Optional[str] = None) -> bool:
    client = get_supabase_client(user_token)
    if not client:
        return False
    try:
        client.table("user_playlist_tracks")\
            .delete()\
            .eq("playlist_id", playlist_id)\
            .eq("video_id", video_id)\
            .execute()
        return True
    except Exception as e:
        print(f"[Supabase] Error removing track from playlist: {e}")
        return False

# ----------------- FOLLOWED ARTISTS (Supabase Cloud PostgreSQL) -----------------

def get_user_followed_artists(user_id: str, user_token: Optional[str] = None) -> List[Dict[str, Any]]:
    client = get_supabase_client(user_token)
    if not client:
        return []
    try:
        res = client.table("user_followed_artists")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        artists = []
        for row in (res.data or []):
            artists.append({
                "name": row.get("artist_name"),
                "id": row.get("artist_browse_id"),
                "avatar": row.get("avatar_url"),
                "subscribers": row.get("subscribers")
            })
        return artists
    except Exception as e:
        print(f"[Supabase] Error fetching followed artists: {e}")
        return []

def add_user_followed_artist(user_id: str, artist: Dict[str, Any], user_token: Optional[str] = None) -> bool:
    client = get_supabase_client(user_token)
    if not client:
        return False
    artist_name = (artist.get("name") or "").strip()
    if not artist_name:
        return False
    now = int(time.time())
    try:
        client.table("user_followed_artists").upsert({
            "user_id": user_id,
            "artist_name": artist_name,
            "artist_browse_id": artist.get("id"),
            "avatar_url": artist.get("avatar"),
            "subscribers": artist.get("subscribers"),
            "created_at": now
        }, on_conflict="user_id,artist_name").execute()
        return True
    except Exception as e:
        print(f"[Supabase] Error adding followed artist: {e}")
        return False

def remove_user_followed_artist(user_id: str, artist_name: str, user_token: Optional[str] = None) -> bool:
    client = get_supabase_client(user_token)
    if not client:
        return False
    try:
        client.table("user_followed_artists")\
            .delete()\
            .eq("user_id", user_id)\
            .eq("artist_name", artist_name.strip())\
            .execute()
        return True
    except Exception as e:
        print(f"[Supabase] Error removing followed artist: {e}")
        return False

# ----------------- SPOTIFY PLAYLISTS (Lightweight Cloud References) -----------------

def save_spotify_playlists_for_user(user_id: str, spotify_playlists: List[Dict[str, Any]], user_token: Optional[str] = None) -> int:
    """
    Saves imported Spotify playlists as lightweight headers only (no individual track rows stored in DB).
    Tracks are loaded dynamically on demand via Spotify link to conserve cloud database storage.
    """
    client = get_supabase_client(user_token)
    if not client:
        return 0
    saved_count = 0
    now = int(time.time())
    for sp_pl in spotify_playlists:
        sp_id = sp_pl.get("spotify_id") or sp_pl.get("id")
        name = sp_pl.get("name") or "Spotify Playlist"
        desc = sp_pl.get("description") or ""
        cover = sp_pl.get("cover_url") or (
            sp_pl.get("images", [{}])[0].get("url")
            if isinstance(sp_pl.get("images"), list) and sp_pl.get("images")
            else None
        )
        playlist_id = f"sp_pl_{sp_id}" if sp_id else f"sp_pl_{int(time.time())}"

        try:
            client.table("user_playlists").upsert({
                "id": playlist_id,
                "user_id": user_id,
                "name": name,
                "description": desc,
                "cover_url": cover,
                "source": "spotify",
                "spotify_playlist_id": sp_id,
                "created_at": now,
                "updated_at": now
            }, on_conflict="id").execute()
            saved_count += 1
        except Exception as e:
            print(f"[Supabase] Error upserting Spotify playlist header: {e}")
    return saved_count

