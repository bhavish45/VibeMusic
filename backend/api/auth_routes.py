from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import time

from services import db_service, auth_service, spotify_service

auth_router = APIRouter(prefix="/auth", tags=["auth"])
user_router = APIRouter(prefix="/user", tags=["user"])
spotify_router = APIRouter(prefix="/spotify", tags=["spotify"])

# ----------------- PYDANTIC MODELS -----------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    displayName: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SpotifyCallbackRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = None

class CreatePlaylistRequest(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    tracks: Optional[List[Dict[str, Any]]] = None

class AddTrackRequest(BaseModel):
    track: Dict[str, Any]

class FollowArtistRequest(BaseModel):
    artist: Dict[str, Any]

class SyncLocalDataRequest(BaseModel):
    favorites: Optional[List[Dict[str, Any]]] = None
    playlists: Optional[List[Dict[str, Any]]] = None
    followedArtists: Optional[List[Dict[str, Any]]] = None

class ResolveTrackRequest(BaseModel):
    title: str
    artist: str

class ImportSpotifyUrlRequest(BaseModel):
    url: str

def sanitize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": user["id"],
        "email": user["email"],
        "displayName": user["display_name"],
        "avatarUrl": user.get("avatar_url"),
        "provider": user.get("provider", "email"),
        "spotifyConnected": bool(user.get("spotify_id") or user.get("provider") == "spotify"),
        "createdAt": user.get("created_at")
    }

# ----------------- AUTH ENDPOINTS (/api/auth) -----------------

@auth_router.post("/register")
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(email) > 254:
        raise HTTPException(status_code=400, detail="Email address is too long.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if len(req.password) > 128:
        raise HTTPException(status_code=400, detail="Password must not exceed 128 characters.")
    if not req.displayName.strip():
        raise HTTPException(status_code=400, detail="Display name is required.")
    if len(req.displayName.strip()) > 100:
        raise HTTPException(status_code=400, detail="Display name must not exceed 100 characters.")

    existing = db_service.get_user_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    pwd_hash = auth_service.hash_password(req.password)
    user = db_service.create_user(
        email=email,
        password_hash=pwd_hash,
        display_name=req.displayName,
        provider="email"
    )
    token = auth_service.create_access_token(user["id"], user["email"])
    return {
        "token": token,
        "user": sanitize_user(user)
    }

@auth_router.post("/login")
def login(req: LoginRequest):
    email = req.email.strip().lower()
    if len(email) > 254 or len(req.password) > 128:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user = db_service.get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.get("password_hash"):
        if user.get("provider") == "spotify":
            raise HTTPException(
                status_code=400,
                detail="This account was registered with Spotify. Please sign in with Spotify."
            )
        raise HTTPException(status_code=401, detail="Invalid account configuration.")

    if not auth_service.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = auth_service.create_access_token(user["id"], user["email"])
    return {
        "token": token,
        "user": sanitize_user(user)
    }

@auth_router.get("/me")
def get_me(user: Dict[str, Any] = Depends(auth_service.get_current_user)):
    favs = db_service.get_user_favorites(user["id"])
    pls = db_service.get_user_playlists(user["id"])
    return {
        "user": sanitize_user(user),
        "favoritesCount": len(favs),
        "playlistsCount": len(pls)
    }

@auth_router.get("/spotify/status")
def spotify_status():
    configured = spotify_service.is_spotify_configured()
    return {
        "configured": configured,
        "authUrl": spotify_service.get_spotify_auth_url() if configured else None
    }

@auth_router.post("/spotify/callback")
async def spotify_callback(req: SpotifyCallbackRequest):
    if not spotify_service.is_spotify_configured():
        raise HTTPException(
            status_code=400,
            detail="Spotify Developer API credentials are not configured in backend/.env"
        )
    try:
        tokens = await spotify_service.exchange_spotify_code(req.code, req.redirect_uri)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to authenticate with Spotify: {str(e)}")

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in", 3600)
    expires_at = int(time.time()) + expires_in

    try:
        profile = await spotify_service.get_spotify_user_profile(access_token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch Spotify profile: {str(e)}")

    sp_id = profile.get("id")
    email = profile.get("email") or f"{sp_id}@spotify.user"
    display_name = profile.get("display_name") or f"Spotify User ({sp_id[:6]})"
    images = profile.get("images", [])
    avatar_url = images[0].get("url") if images else None

    # Check if user with spotify_id exists
    user = db_service.get_user_by_spotify_id(sp_id)
    if not user:
        # Check if user with this email exists
        user = db_service.get_user_by_email(email)
        if user:
            # Link spotify
            db_service.update_user_spotify_info(
                user["id"], sp_id, access_token, refresh_token, expires_at, avatar_url
            )
        else:
            user = db_service.create_user(
                email=email,
                password_hash=None,
                display_name=display_name,
                avatar_url=avatar_url,
                provider="spotify",
                spotify_id=sp_id,
                spotify_access_token=access_token,
                spotify_refresh_token=refresh_token,
                spotify_token_expires_at=expires_at
            )
    else:
        db_service.update_user_spotify_info(
            user["id"], sp_id, access_token, refresh_token, expires_at, avatar_url
        )

    # Automatically load user's Spotify saved playlists!
    imported_count = 0
    try:
        spotify_playlists = await spotify_service.fetch_spotify_user_playlists(access_token)
        imported_count = db_service.save_spotify_playlists_for_user(user["id"], spotify_playlists)
        print(f"[Spotify] Successfully imported {imported_count} Spotify playlists for user {user['id']}")
    except Exception as e:
        print(f"[Spotify] Note: Could not import playlists: {e}")

    token = auth_service.create_access_token(user["id"], user["email"])
    return {
        "token": token,
        "user": sanitize_user(user),
        "importedPlaylistsCount": imported_count
    }

# ----------------- SPOTIFY TRACK RESOLUTION (/api/spotify) -----------------

@spotify_router.post("/resolve-track")
async def resolve_spotify_track(req: ResolveTrackRequest):
    match = await spotify_service.resolve_spotify_track_to_youtube(req.title, req.artist)
    if not match:
        raise HTTPException(status_code=404, detail="No matching audio stream found for track.")
    return match

@spotify_router.get("/track-poster/{sp_id}")
async def get_spotify_track_poster(sp_id: str):
    poster = await spotify_service.get_spotify_track_poster(sp_id)
    if not poster:
        raise HTTPException(status_code=404, detail="Track poster not found.")
    return {"poster": poster}

@spotify_router.post("/import-url")
async def import_spotify_url(
    req: ImportSpotifyUrlRequest,
    user: Optional[Dict[str, Any]] = Depends(auth_service.get_optional_current_user)
):
    try:
        playlist_data = await spotify_service.import_spotify_playlist_by_url(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    saved_count = 0
    if user:
        user_token = user.get("token")
        saved_count = db_service.save_spotify_playlists_for_user(user["id"], [playlist_data], user_token=user_token)

    return {
        "success": True,
        "playlist": playlist_data,
        "savedToAccount": bool(user),
        "importedPlaylistsCount": saved_count
    }

@spotify_router.get("/playlist/{spotify_id}")
async def get_spotify_playlist_details(spotify_id: str):
    """
    Fetches Spotify playlist tracks on-demand without saving tracks to the cloud database.
    """
    clean_id = spotify_id.replace("sp_pl_", "").strip()
    try:
        playlist_data = await spotify_service.import_spotify_playlist_by_url(
            f"https://open.spotify.com/playlist/{clean_id}"
        )
        return {"success": True, "playlist": playlist_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ----------------- USER LIBRARY ENDPOINTS (/api/user) -----------------

@user_router.get("/library")
def get_user_library(user: Dict[str, Any] = Depends(auth_service.get_current_user)):
    user_token = user.get("token")
    favorites = db_service.get_user_favorites(user["id"], user_token=user_token)
    playlists = db_service.get_user_playlists(user["id"], user_token=user_token)
    followed_artists = db_service.get_user_followed_artists(user["id"], user_token=user_token)
    return {
        "favorites": favorites,
        "playlists": playlists,
        "followedArtists": followed_artists
    }

@user_router.post("/favorites")
def add_favorite(
    track: Dict[str, Any],
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    video_id = track.get("videoId")
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid track data: videoId required.")
    user_token = user.get("token")
    success = db_service.add_user_favorite(user["id"], track, user_token=user_token)
    return {"success": success, "videoId": video_id, "isFavorite": True}

@user_router.delete("/favorites/{video_id}")
def remove_favorite(
    video_id: str,
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    user_token = user.get("token")
    success = db_service.remove_user_favorite(user["id"], video_id, user_token=user_token)
    return {"success": success, "videoId": video_id, "isFavorite": False}

@user_router.post("/playlists")
def create_playlist(
    req: CreatePlaylistRequest,
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Playlist name is required.")
    user_token = user.get("token")
    playlist = db_service.create_user_playlist(
        user_id=user["id"],
        name=req.name,
        description=req.description,
        cover_url=req.cover_url,
        tracks=req.tracks,
        playlist_id=req.id,
        user_token=user_token
    )
    return playlist

@user_router.delete("/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: str,
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    user_token = user.get("token")
    deleted = db_service.delete_user_playlist(user["id"], playlist_id, user_token=user_token)
    if not deleted:
        raise HTTPException(status_code=404, detail="Playlist not found or unauthorized.")
    return {"success": True, "playlistId": playlist_id}

@user_router.post("/playlists/{playlist_id}/tracks")
def add_track_to_user_playlist(
    playlist_id: str,
    req: AddTrackRequest,
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    user_token = user.get("token")
    playlist = db_service.get_playlist_by_id(playlist_id, user_token=user_token)
    if not playlist or playlist.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Playlist not found or unauthorized.")
    if playlist.get("source") == "spotify":
        raise HTTPException(status_code=400, detail="Cannot modify imported Spotify playlists.")
    success = db_service.add_track_to_playlist(playlist_id, req.track, user_token=user_token)
    return {"success": success, "playlist": db_service.get_playlist_by_id(playlist_id, user_token=user_token)}

@user_router.delete("/playlists/{playlist_id}/tracks/{video_id}")
def remove_track_from_user_playlist(
    playlist_id: str,
    video_id: str,
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    user_token = user.get("token")
    playlist = db_service.get_playlist_by_id(playlist_id, user_token=user_token)
    if not playlist or playlist.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Playlist not found or unauthorized.")
    if playlist.get("source") == "spotify":
        raise HTTPException(status_code=400, detail="Cannot delete tracks from imported Spotify playlists.")
    success = db_service.remove_track_from_playlist(playlist_id, video_id, user_token=user_token)
    return {"success": success, "playlist": db_service.get_playlist_by_id(playlist_id, user_token=user_token)}

# ----------------- FOLLOWED ARTISTS ENDPOINTS (/api/user/artists) -----------------

@user_router.get("/artists")
def get_followed_artists(user: Dict[str, Any] = Depends(auth_service.get_current_user)):
    user_token = user.get("token")
    artists = db_service.get_user_followed_artists(user["id"], user_token=user_token)
    return {"artists": artists}

@user_router.post("/artists")
def follow_artist(
    req: FollowArtistRequest,
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    artist = req.artist
    name = (artist.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Artist name is required.")
    user_token = user.get("token")
    success = db_service.add_user_followed_artist(user["id"], artist, user_token=user_token)
    return {"success": success, "artist": artist, "isFollowing": True}

@user_router.delete("/artists/{artist_name}")
def unfollow_artist(
    artist_name: str,
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    if not artist_name.strip():
        raise HTTPException(status_code=400, detail="Artist name is required.")
    user_token = user.get("token")
    success = db_service.remove_user_followed_artist(user["id"], artist_name, user_token=user_token)
    return {"success": success, "artistName": artist_name, "isFollowing": False}

@user_router.post("/sync-local")
def sync_local_data(
    req: SyncLocalDataRequest,
    user: Dict[str, Any] = Depends(auth_service.get_current_user)
):
    """
    Syncs/merges guest local favorites, playlists, and followed artists into the authenticated user's account.
    """
    user_token = user.get("token")
    synced_favs = 0
    synced_pls = 0
    synced_artists = 0

    if req.favorites:
        for t in req.favorites:
            if t.get("videoId"):
                db_service.add_user_favorite(user["id"], t, user_token=user_token)
                synced_favs += 1

    if req.playlists:
        for p in req.playlists:
            name = p.get("name")
            if name:
                db_service.create_user_playlist(
                    user_id=user["id"],
                    name=name,
                    tracks=p.get("tracks", []),
                    user_token=user_token
                )
                synced_pls += 1

    if req.followedArtists:
        for a in req.followedArtists:
            if a.get("name"):
                db_service.add_user_followed_artist(user["id"], a, user_token=user_token)
                synced_artists += 1

    return {
        "success": True,
        "syncedFavorites": synced_favs,
        "syncedPlaylists": synced_pls,
        "syncedArtists": synced_artists,
        "library": {
            "favorites": db_service.get_user_favorites(user["id"], user_token=user_token),
            "playlists": db_service.get_user_playlists(user["id"], user_token=user_token),
            "followedArtists": db_service.get_user_followed_artists(user["id"], user_token=user_token)
        }
    }
