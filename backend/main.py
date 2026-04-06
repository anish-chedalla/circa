"""FastAPI application entry point for the Circa API."""

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import Base, SessionLocal, engine
from backend.models.user import User
from backend.services.verification_system import hash_password

# Load environment variables before anything else
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)
_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup and clean up on shutdown."""
    # Import models so Base.metadata knows about every table
    import backend.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_google_enrichment_columns()
    _ensure_default_admin_user()
    yield


def _ensure_google_enrichment_columns() -> None:
    """Ensure enrichment columns exist for existing deployments.

    This project currently uses model-driven table creation without migrations.
    Existing Supabase tables need explicit ALTER statements for new columns.
    """
    statements = [
        """
        CREATE TABLE IF NOT EXISTS business_events (
            id SERIAL PRIMARY KEY,
            business_id INTEGER NOT NULL REFERENCES businesses(id),
            event_type VARCHAR(50) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_business_events_business_id ON business_events (business_id)",
        "CREATE INDEX IF NOT EXISTS ix_business_events_event_type ON business_events (event_type)",
        "CREATE INDEX IF NOT EXISTS ix_business_events_created_at ON business_events (created_at)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(120)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(1024)",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS state VARCHAR(10)",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(128)",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_photo_ref VARCHAR(512)",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_photo_url VARCHAR(1024)",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_summary TEXT",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_last_synced_at TIMESTAMPTZ",
        "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS listing_status VARCHAR(20) DEFAULT 'approved'",
        "UPDATE businesses SET listing_status = 'approved' WHERE listing_status IS NULL",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def _ensure_default_admin_user() -> None:
    """Create or update a default admin login for local/demo use."""
    admin_email = "anish@circa.org"
    admin_password = "Anish1234"

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.email == admin_email).first()
        if user is None:
            user = User(
                email=admin_email,
                display_name="Anish",
                password_hash=hash_password(admin_password),
                role="admin",
                is_active=True,
            )
            db.add(user)
            db.commit()
            return

        user.password_hash = hash_password(admin_password)
        user.display_name = user.display_name or "Anish"
        user.role = "admin"
        user.is_active = True
        db.commit()
    finally:
        db.close()


app = FastAPI(
    title="Circa API",
    description="Backend API for Circa — a local business discovery platform for Arizona.",
    version="0.1.0",
    lifespan=lifespan,
)
app.mount("/uploads", StaticFiles(directory=_uploads_dir), name="uploads")

# ---------------------------------------------------------------------------
# CORS — allow all origins during development
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from backend.routes.auth import router as auth_router
from backend.routes.businesses import router as businesses_router
from backend.routes.reviews import router as reviews_router
from backend.routes.favorites import router as favorites_router
from backend.routes.owner import router as owner_router
from backend.routes.claims import router as claims_router
from backend.routes.recommendations import router as recommendations_router
from backend.routes.analytics import router as analytics_router
from backend.routes.admin import router as admin_router

app.include_router(auth_router)
app.include_router(businesses_router)
app.include_router(reviews_router)
app.include_router(favorites_router)
app.include_router(owner_router)
app.include_router(claims_router)
app.include_router(recommendations_router)
app.include_router(analytics_router)
app.include_router(admin_router)


@app.get("/api/health", tags=["health"])
async def health_check():
    """Return a simple health-check response to verify the API is running."""
    return {"data": {"status": "healthy"}, "error": None}
