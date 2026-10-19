import sqlite3
import json
import os
import time
import uuid
from typing import Optional, List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vibemusic.db")

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    conn = get_db_connection()
    try:
        with conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                display_name TEXT NOT NULL,
                avatar_url TEXT,
                provider TEXT NOT NULL DEFAULT 'email',
                spotify_id TEXT UNIQUE,
                spotify_access_token TEXT,
                spotify_refresh_token TEXT,
                spotify_token_expires_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                video_id TEXT NOT NULL,
                track_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE(user_id, video_id),
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);

            CREATE TABLE IF NOT EXISTS user_playlists (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                cover_url TEXT,
                source TEXT NOT NULL DEFAULT 'custom',
                spotify_playlist_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_playlists_user ON user_playlists(user_id);

            CREATE TABLE IF NOT EXISTS user_playlist_tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id TEXT NOT NULL,
                video_id TEXT NOT NULL,
                track_json TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                UNIQUE(playlist_id, video_id),
                FOREIGN KEY (playlist_id) REFERENCES user_playlists (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON user_playlist_tracks(playlist_id, position);
            """)
        print("[DB] SQLite database initialized successfully at", DB_PATH)
    finally:
        conn.close()

# ----------------- USER OPERATIONS -----------------

def create_user(
    email: str,
    password_hash: Optional[str],
    display_name: str,
    avatar_url: Optional[str] = None,
    provider: str = "email",
    spotify_id: Optional[str] = None,
    spotify_access_token: Optional[str] = None,
    spotify_refresh_token: Optional[str] = None,
    spotify_token_expires_at: Optional[int] = None
) -> Dict[str, Any]:
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    now = int(time.time())
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO users (
                    id, email, password_hash, display_name, avatar_url,
                    provider, spotify_id, spotify_access_token,
                    spotify_refresh_token, spotify_token_expires_at,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id, email.lower().strip(), password_hash, display_name.strip(),
                    avatar_url, provider, spotify_id, spotify_access_token,
                    spotify_refresh_token, spotify_token_expires_at, now, now
                )
            )
        return get_user_by_id(user_id)
    finally:
        conn.close()

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()

def get_user_by_spotify_id(spotify_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE spotify_id = ?", (spotify_id,)).fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()

def update_user_spotify_info(
    user_id: str,
    spotify_id: str,
    access_token: str,
    refresh_token: Optional[str],
    expires_at: int,
    avatar_url: Optional[str] = None
):
    now = int(time.time())
    conn = get_db_connection()
    try:
        with conn:
            if refresh_token:
                conn.execute(
                    """
                    UPDATE users SET
                        spotify_id = ?,
                        spotify_access_token = ?,
                        spotify_refresh_token = ?,
                        spotify_token_expires_at = ?,
                        avatar_url = COALESCE(?, avatar_url),
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (spotify_id, access_token, refresh_token, expires_at, avatar_url, now, user_id)
                )
            else:
                conn.execute(
                    """
                    UPDATE users SET
                        spotify_id = ?,
                        spotify_access_token = ?,
                        spotify_token_expires_at = ?,
                        avatar_url = COALESCE(?, avatar_url),
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (spotify_id, access_token, expires_at, avatar_url, now, user_id)
                )
    finally:
        conn.close()

# ----------------- FAVORITES OPERATIONS -----------------

def get_user_favorites(user_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT track_json FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        ).fetchall()
        favorites = []
        for r in rows:
            try:
                favorites.append(json.loads(r["track_json"]))
            except Exception:
                pass
        return favorites
    finally:
        conn.close()

def add_user_favorite(user_id: str, track: Dict[str, Any]) -> bool:
    video_id = track.get("videoId")
    if not video_id:
        return False
    now = int(time.time())
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO user_favorites (user_id, video_id, track_json, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (user_id, video_id, json.dumps(track), now)
            )
        return True
    finally:
        conn.close()

def remove_user_favorite(user_id: str, video_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                "DELETE FROM user_favorites WHERE user_id = ? AND video_id = ?",
                (user_id, video_id)
            )
        return True
    finally:
        conn.close()

def is_user_favorite(user_id: str, video_id: str) -> bool:
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT 1 FROM user_favorites WHERE user_id = ? AND video_id = ?",
            (user_id, video_id)
        ).fetchone()
        return row is not None
    finally:
        conn.close()

# ----------------- PLAYLIST OPERATIONS -----------------

def get_user_playlists(user_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT p.*, COUNT(t.id) as track_count
            FROM user_playlists p
            LEFT JOIN user_playlist_tracks t ON p.id = t.playlist_id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
            """,
            (user_id,)
        ).fetchall()

        playlists = []
        for r in rows:
            p_dict = dict(r)
            # Fetch tracks for this playlist
            track_rows = conn.execute(
                "SELECT track_json FROM user_playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, created_at ASC",
                (r["id"],)
            ).fetchall()
            tracks = []
            for tr in track_rows:
                try:
                    tracks.append(json.loads(tr["track_json"]))
                except Exception:
                    pass
            p_dict["tracks"] = tracks
            playlists.append(p_dict)
        return playlists
    finally:
        conn.close()

def create_user_playlist(
    user_id: str,
    name: str,
    description: Optional[str] = None,
    cover_url: Optional[str] = None,
    source: str = "custom",
    spotify_playlist_id: Optional[str] = None,
    tracks: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    playlist_id = f"pl_{uuid.uuid4().hex[:12]}"
    now = int(time.time())
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO user_playlists (
                    id, user_id, name, description, cover_url, source, spotify_playlist_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (playlist_id, user_id, name.strip(), description, cover_url, source, spotify_playlist_id, now, now)
            )

            if tracks:
                for idx, track in enumerate(tracks):
                    vid = track.get("videoId") or f"sp_{uuid.uuid4().hex[:8]}"
                    # Ensure track has videoId
                    track["videoId"] = vid
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO user_playlist_tracks (playlist_id, video_id, track_json, position, created_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (playlist_id, vid, json.dumps(track), idx, now)
                    )
        return get_playlist_by_id(playlist_id)
    finally:
        conn.close()

def get_playlist_by_id(playlist_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM user_playlists WHERE id = ?", (playlist_id,)).fetchone()
        if not row:
            return None
        p_dict = dict(row)
        track_rows = conn.execute(
            "SELECT track_json FROM user_playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, created_at ASC",
            (playlist_id,)
        ).fetchall()
        tracks = []
        for tr in track_rows:
            try:
                tracks.append(json.loads(tr["track_json"]))
            except Exception:
                pass
        p_dict["tracks"] = tracks
        return p_dict
    finally:
        conn.close()

def delete_user_playlist(user_id: str, playlist_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            # Match either by id, spotify_playlist_id, or with/without 'sp_pl_' prefix
            row = conn.execute(
                """
                SELECT id FROM user_playlists 
                WHERE user_id = ? AND (
                    id = ? OR 
                    spotify_playlist_id = ? OR 
                    id = ? OR 
                    spotify_playlist_id = ?
                )
                """,
                (user_id, playlist_id, playlist_id, f"sp_pl_{playlist_id}", playlist_id.replace("sp_pl_", ""))
            ).fetchone()
            if not row:
                return False
            actual_id = row["id"]
            conn.execute("DELETE FROM user_playlist_tracks WHERE playlist_id = ?", (actual_id,))
            cursor = conn.execute("DELETE FROM user_playlists WHERE id = ? AND user_id = ?", (actual_id, user_id))
            return cursor.rowcount > 0
    finally:
        conn.close()

def add_track_to_playlist(playlist_id: str, track: Dict[str, Any]) -> bool:
    video_id = track.get("videoId")
    if not video_id:
        return False
    now = int(time.time())
    conn = get_db_connection()
    try:
        with conn:
            # Get max position
            pos_row = conn.execute(
                "SELECT COALESCE(MAX(position), -1) as max_pos FROM user_playlist_tracks WHERE playlist_id = ?",
                (playlist_id,)
            ).fetchone()
            next_pos = (pos_row["max_pos"] if pos_row else -1) + 1

            conn.execute(
                """
                INSERT OR REPLACE INTO user_playlist_tracks (playlist_id, video_id, track_json, position, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (playlist_id, video_id, json.dumps(track), next_pos, now)
            )
            conn.execute("UPDATE user_playlists SET updated_at = ? WHERE id = ?", (now, playlist_id))
        return True
    finally:
        conn.close()

def remove_track_from_playlist(playlist_id: str, video_id: str) -> bool:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                "DELETE FROM user_playlist_tracks WHERE playlist_id = ? AND video_id = ?",
                (playlist_id, video_id)
            )
            now = int(time.time())
            conn.execute("UPDATE user_playlists SET updated_at = ? WHERE id = ?", (now, playlist_id))
        return True
    finally:
        conn.close()

def save_spotify_playlists_for_user(user_id: str, spotify_playlists: List[Dict[str, Any]]) -> int:
    """
    Saves or refreshes imported Spotify playlists and their tracks for a user.
    Returns the count of saved playlists.
    """
    conn = get_db_connection()
    saved_count = 0
    now = int(time.time())
    try:
        with conn:
            for sp_pl in spotify_playlists:
                sp_id = sp_pl.get("spotify_id") or sp_pl.get("id")
                name = sp_pl.get("name") or "Spotify Playlist"
                desc = sp_pl.get("description") or ""
                cover = sp_pl.get("cover_url") or sp_pl.get("images", [{}])[0].get("url") if isinstance(sp_pl.get("images"), list) and sp_pl.get("images") else None
                tracks = sp_pl.get("tracks") or []

                # Check if this Spotify playlist was already imported for this user
                existing = conn.execute(
                    "SELECT id FROM user_playlists WHERE user_id = ? AND spotify_playlist_id = ?",
                    (user_id, sp_id)
                ).fetchone()

                if existing:
                    playlist_id = existing["id"]
                    conn.execute(
                        """
                        UPDATE user_playlists SET
                            name = ?, description = ?, cover_url = ?, updated_at = ?
                        WHERE id = ?
                        """,
                        (name, desc, cover, now, playlist_id)
                    )
                    # Clear old tracks and re-insert
                    conn.execute("DELETE FROM user_playlist_tracks WHERE playlist_id = ?", (playlist_id,))
                else:
                    playlist_id = f"sp_pl_{sp_id}" if sp_id else f"sp_pl_{uuid.uuid4().hex[:10]}"
                    conn.execute(
                        """
                        INSERT INTO user_playlists (
                            id, user_id, name, description, cover_url, source, spotify_playlist_id, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, 'spotify', ?, ?, ?)
                        """,
                        (playlist_id, user_id, name, desc, cover, sp_id, now, now)
                    )

                # Insert tracks
                for idx, track in enumerate(tracks):
                    vid = track.get("videoId") or f"sp_{uuid.uuid4().hex[:8]}"
                    track["videoId"] = vid
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO user_playlist_tracks (playlist_id, video_id, track_json, position, created_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (playlist_id, vid, json.dumps(track), idx, now)
                    )
                saved_count += 1
        return saved_count
    finally:
        conn.close()
