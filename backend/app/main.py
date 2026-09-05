from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
import dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    dotenv.load_dotenv(dotenv_path=env_path)
else:
    dotenv.load_dotenv()

from app.database import engine, Base
from app.routes import products, cart, agent, payment, auth

# Create SQLite database tables if they do not exist
# Note: In production we'd use Alembic, but for this project local seeding is direct
Base.metadata.create_all(bind=engine)

# --- Lightweight migration for the auth columns added to `users` ---
# Base.metadata.create_all() above only creates tables that don't already
# exist; it does NOT add new columns to a `users` table that already exists
# from before auth was introduced. This adds any missing auth columns
# in place so the existing shopgenie.db (and its existing cart/order data)
# doesn't need to be recreated from scratch.
def _migrate_users_table():
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    existing_cols = {col["name"] for col in inspector.get_columns("users")}
    required_cols = {
        "email": "VARCHAR",
        "full_name": "VARCHAR",
        "hashed_password": "VARCHAR",
        "is_verified": "BOOLEAN DEFAULT 0",
        "otp_code": "VARCHAR",
        "otp_expires_at": "DATETIME",
        "last_otp_sent_at": "DATETIME",
        "otp_attempts": "INTEGER DEFAULT 0",
    }
    with engine.begin() as conn:
        for col_name, col_type in required_cols.items():
            if col_name not in existing_cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                print(f"[shopgenie][migration] Added missing column users.{col_name}")

_migrate_users_table()

app = FastAPI(
    title="ShopGenie API",
    description="Backend services for ShopGenie - AI Agentic Shopping Assistant",
    version="1.0.0"
)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "").strip()
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(cart.router, prefix="/api")
app.include_router(agent.router, prefix="/api")
app.include_router(payment.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "message": "Welcome to ShopGenie Backend API!",
        "status": "online",
        "demo_mode": not os.getenv("GEMINI_API_KEY", "").strip()
    }