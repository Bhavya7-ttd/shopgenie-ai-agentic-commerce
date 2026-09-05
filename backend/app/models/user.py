from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # --- Auth fields (added for login/registration/OTP verification) ---
    email = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Demo OTP mechanism: a 6-digit code + expiry stored on the user row.
    # See app/core/security.py for how this is generated/consumed.
    # This is a self-contained demo flow (no third-party email/SMS provider);
    # the OTP is returned directly in the API response and printed to the
    # backend console so it can be reliably demonstrated live.
    otp_code = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    last_otp_sent_at = Column(DateTime, nullable=True)
    otp_attempts = Column(Integer, default=0, nullable=False)

