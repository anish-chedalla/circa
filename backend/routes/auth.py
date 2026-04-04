"""Authentication routes: register, login, and current-user retrieval."""

import os
import re

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.services.verification_system import (
    create_jwt_token,
    hash_password,
    verify_password,
    verify_recaptcha,
)
from backend.utils.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------

_PASSWORD_PATTERN = re.compile(r"^(?=.*\d).{8,}$")


class RegisterRequest(BaseModel):
    """Payload for the registration endpoint."""

    email: EmailStr
    password: str
    captcha_token: str


class LoginRequest(BaseModel):
    """Payload for the login endpoint."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Public-facing user representation."""

    id: int
    email: str
    role: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _user_dict(user: User) -> dict:
    """Convert a User ORM instance to a plain dict for responses."""
    return {"id": user.id, "email": user.email, "role": user.role}


def _is_recaptcha_placeholder() -> bool:
    """Return True when the reCAPTCHA secret is the default placeholder."""
    secret = os.environ.get("RECAPTCHA_SECRET_KEY", "")
    return secret == "your-recaptcha-secret-key"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/register")
async def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account and return a JWT."""
    # reCAPTCHA verification (skipped for placeholder key)
    if not _is_recaptcha_placeholder():
        captcha_ok = await verify_recaptcha(body.captcha_token)
        if not captcha_ok:
            return JSONResponse(
                status_code=400,
                content={"data": None, "error": "reCAPTCHA verification failed"},
            )

    # Password strength check
    if not _PASSWORD_PATTERN.match(body.password):
        return JSONResponse(
            status_code=400,
            content={
                "data": None,
                "error": "Password must be at least 8 characters with at least one digit",
            },
        )

    # Duplicate-email check
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        return JSONResponse(
            status_code=409,
            content={"data": None, "error": "Email is already registered"},
        )

    # Create user
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_jwt_token(user.id, user.email, user.role)
    return {
        "data": {"token": token, "user": _user_dict(user)},
        "error": None,
    }


@router.post("/login")
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT."""
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not verify_password(body.password, user.password_hash):
        return JSONResponse(
            status_code=401,
            content={"data": None, "error": "Invalid email or password"},
        )

    if not user.is_active:
        return JSONResponse(
            status_code=401,
            content={"data": None, "error": "Account is deactivated"},
        )

    token = create_jwt_token(user.id, user.email, user.role)
    return {
        "data": {"token": token, "user": _user_dict(user)},
        "error": None,
    }


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return {
        "data": _user_dict(current_user),
        "error": None,
    }
