from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services import db_service, email_service
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_otp,
    otp_expiry,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ---------- Request / response schemas ----------
class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters long.")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Email address is required.")
        return str(v).lower().strip()

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Full name is required.")
        return v


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Email address is required.")
        return str(v).lower().strip()


class ResendOtpRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Email address is required.")
        return str(v).lower().strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v):
        if not v or not str(v).strip():
            raise ValueError("Email address is required.")
        return str(v).lower().strip()


def _user_public(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "is_verified": user.is_verified,
    }


# ---------- Routes ----------
@router.post("/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a new account. Sends 6-digit OTP to the registered email address
    if SMTP configuration is provided, or uses explicit DEMO MODE if not.
    """
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    existing = db_service.get_user_by_email(db, payload.email)
    if existing and existing.is_verified:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please log in.")

    # 30-second cooldown check if unverified user is re-submitting registration
    if existing and not existing.is_verified and existing.last_otp_sent_at:
        elapsed = (datetime.utcnow() - existing.last_otp_sent_at).total_seconds()
        if elapsed < 30:
            remaining = int(30 - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting a new OTP."
            )

    otp_code = generate_otp()
    expires_at = otp_expiry()

    if existing and not existing.is_verified:
        existing.full_name = payload.full_name.strip()
        existing.hashed_password = hash_password(payload.password)
        db_service.set_user_otp(db, existing, otp_code, expires_at)
        user = existing
    else:
        user = db_service.create_unverified_user(
            db,
            full_name=payload.full_name,
            email=payload.email,
            hashed_password=hash_password(payload.password),
            otp_code=otp_code,
            otp_expires_at=expires_at,
        )

    # --- EMAIL DELIVERY OR DEMO MODE ---
    if email_service.is_smtp_configured():
        email_res = email_service.send_otp_email(user.email, otp_code, user.full_name)
        if not email_res.get("sent"):
            raise HTTPException(
                status_code=500,
                detail="Failed to send verification email. Please verify your email address or try again later."
            )
        return {
            "message": "We've sent a verification code to your email address.",
            "email": user.email,
            "demo_mode": False
        }
    else:
        print(f"[shopgenie][demo-otp] DEMO MODE OTP for {user.email}: {otp_code} (expires in 10 minutes)")
        return {
            "message": "DEMO MODE: No SMTP configured. An OTP has been generated for demo verification.",
            "email": user.email,
            "demo_mode": True,
            "demo_otp": otp_code,
        }


@router.post("/verify-otp")
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    user = db_service.get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email.")
    if user.is_verified:
        return {"message": "Account already verified.", "verified": True}

    if not user.otp_code or not user.otp_expires_at:
        raise HTTPException(status_code=400, detail="No OTP was requested for this account. Please register or resend OTP.")

    if datetime.utcnow() > user.otp_expires_at:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # Check attempt limit (max 5 failed attempts)
    if (user.otp_attempts or 0) >= 5:
        db_service.set_user_otp(db, user, None, None)
        raise HTTPException(
            status_code=400,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )

    if payload.otp.strip() != user.otp_code:
        attempts = db_service.increment_otp_attempts(db, user)
        remaining = max(0, 5 - attempts)
        if remaining == 0:
            db_service.set_user_otp(db, user, None, None)
            raise HTTPException(
                status_code=400,
                detail="Incorrect OTP. Maximum attempts reached. Please request a new OTP."
            )
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect OTP. {remaining} attempt(s) remaining."
        )

    db_service.mark_user_verified(db, user)
    return {"message": "Account verified successfully. You can now log in.", "verified": True}


@router.post("/resend-otp")
def resend_otp(payload: ResendOtpRequest, db: Session = Depends(get_db)):
    user = db_service.get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email.")
    if user.is_verified:
        return {"message": "Account already verified.", "verified": True}

    # 30-second cooldown check
    if user.last_otp_sent_at:
        elapsed = (datetime.utcnow() - user.last_otp_sent_at).total_seconds()
        if elapsed < 30:
            remaining = int(30 - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting a new OTP."
            )

    otp_code = generate_otp()
    expires_at = otp_expiry()
    db_service.set_user_otp(db, user, otp_code, expires_at)

    if email_service.is_smtp_configured():
        email_res = email_service.send_otp_email(user.email, otp_code, user.full_name)
        if not email_res.get("sent"):
            raise HTTPException(
                status_code=500,
                detail="Failed to send verification email. Please try again later."
            )
        return {
            "message": "A new verification code has been sent to your email address.",
            "email": user.email,
            "demo_mode": False
        }
    else:
        print(f"[shopgenie][demo-otp] Resent DEMO OTP for {user.email}: {otp_code} (expires in 10 minutes)")
        return {
            "message": "A new demo OTP has been generated.",
            "email": user.email,
            "demo_mode": True,
            "demo_otp": otp_code,
        }



@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db_service.get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your account with the OTP sent to your email before logging in.")

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_public(user),
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return _user_public(current_user)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    # JWTs are stateless, so logout is enforced client-side by discarding the
    # token. This endpoint exists so the frontend has a clean call to make
    # and so the action is auditable server-side if needed later.
    return {"message": "Logged out successfully."}
