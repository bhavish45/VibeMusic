import hashlib
import os
import secrets
import time
from typing import Optional, Dict, Any
import jwt
from fastapi import Header, HTTPException, status
from services import db_service

JWT_SECRET = os.getenv("JWT_SECRET", "vibemusic_production_jwt_secret_key_2026_9837a6b4c12")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 30 * 24 * 3600  # 30 days

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"{salt.hex()}${key.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split('$')
        if len(parts) != 2:
            return False
        salt = bytes.fromhex(parts[0])
        original_key = bytes.fromhex(parts[1])
        new_key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return secrets.compare_digest(original_key, new_key)
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + JWT_EXPIRATION_SECONDS
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None

def extract_token_from_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    if len(parts) == 1:
        return parts[0]
    return None

def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    token = extract_token_from_header(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to perform this action."
        )

    # 1. Check if Supabase client is configured and can verify this token
    from services import supabase_service
    if supabase_service.is_supabase_configured():
        client = supabase_service.get_supabase_client()
        if client:
            try:
                res = client.auth.get_user(token)
                if res and res.user:
                    su_user = res.user
                    meta = su_user.user_metadata or {}
                    return {
                        "id": su_user.id,
                        "email": su_user.email,
                        "display_name": meta.get("displayName") or meta.get("full_name") or (su_user.email.split("@")[0] if su_user.email else "User"),
                        "avatar_url": meta.get("avatar_url"),
                        "provider": "email",
                        "created_at": int(time.time()),
                        "token": token
                    }
            except Exception:
                pass

    # 2. Local JWT token verification
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token. Please sign in again."
        )
    user = db_service.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found."
        )
    user_dict = dict(user)
    user_dict["token"] = token
    return user_dict

def get_optional_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    token = extract_token_from_header(authorization)
    if not token:
        return None

    from services import supabase_service
    if supabase_service.is_supabase_configured():
        client = supabase_service.get_supabase_client(token)
        if client:
            try:
                res = client.auth.get_user(token)
                if res and res.user:
                    su_user = res.user
                    meta = su_user.user_metadata or {}
                    return {
                        "id": su_user.id,
                        "email": su_user.email,
                        "display_name": meta.get("displayName") or meta.get("full_name") or (su_user.email.split("@")[0] if su_user.email else "User"),
                        "avatar_url": meta.get("avatar_url"),
                        "provider": "email",
                        "created_at": int(time.time()),
                        "token": token
                    }
            except Exception:
                pass

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        return None
    user = db_service.get_user_by_id(payload["sub"])
    if user:
        user_dict = dict(user)
        user_dict["token"] = token
        return user_dict
    return None

