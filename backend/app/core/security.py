"""
Authentication utilities: password hashing, JWT access tokens, and a
demo-friendly OTP mechanism.

SECURITY NOTES:
- Passwords are hashed with bcrypt (via passlib) before being stored.
  Plain-text passwords are never persisted.
- JWT_SECRET_KEY is read from backend/.env only. If it is not set, we
  generate a random ephemeral secret for this process so the app still
  runs for a demo, but all issued tokens/sessions become invalid the
  next time the backend restarts. For a persistent demo, set a fixed
  JWT_SECRET_KEY in backend/.env.
- The OTP mechanism below is intentionally simple and self-contained
  (no third-party email/SMS provider) so it can be reliably demoed:
  the generated code is returned in the API response body and also
  printed to the backend console. This is clearly a DEMO mechanism,
  not a production email-delivery integration.
"""
import os
import secrets
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import dotenv
import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db

# Ensure backend/.env is loaded (mirrors main.py / payment_service.py)
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    dotenv.load_dotenv(dotenv_path=env_path)
else:
    dotenv.load_dotenv()

# --- JWT config ---
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days - convenient for a demo/buildathon

_env_secret = os.getenv("JWT_SECRET_KEY", "").strip()
if _env_secret:
    JWT_SECRET_KEY = _env_secret
else:
    JWT_SECRET_KEY = secrets.token_hex(32)
    print(
        "[shopgenie][auth] WARNING: JWT_SECRET_KEY is not set in backend/.env. "
        "Using a random ephemeral secret for this process only — all logged-in "
        "sessions will be invalidated on the next backend restart. Set "
        "JWT_SECRET_KEY in backend/.env for persistent sessions."
    )

# --- Password hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)


# --- JWT access tokens ---
def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


# --- Demo OTP mechanism ---
OTP_EXPIRE_MINUTES = 10


def generate_otp() -> str:
    """Generates a cryptographically secure 6-digit numeric OTP code (100000-999999)."""
    return str(secrets.randbelow(900000) + 100000)


def otp_expiry() -> datetime:
    return datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)


# --- FastAPI dependency: get_current_user ---
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    # Local import to avoid circular imports (app.database <-> app.core.security)
    from app.services import db_service

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload.")

    user = db_service.get_user_by_id(db, int(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists.")
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not verified.")

    return user
