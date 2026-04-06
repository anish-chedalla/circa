"""Authentication routes: register, login, and current-user retrieval."""

import os
import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Request, UploadFile
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
_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "profile-images"
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
_ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024


class RegisterRequest(BaseModel):
    """Payload for the registration endpoint."""

    email: EmailStr
    display_name: str
    password: str
    captcha_token: str


class LoginRequest(BaseModel):
    """Payload for the login endpoint."""

    email: EmailStr
    password: str
    captcha_token: str


class UserResponse(BaseModel):
    """Public-facing user representation."""

    id: int
    email: str
    display_name: str | None
    profile_image_url: str | None
    role: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _user_dict(user: User) -> dict:
    """Convert a User ORM instance to a plain dict for responses."""
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "profile_image_url": user.profile_image_url,
        "role": user.role,
    }


def _is_recaptcha_placeholder() -> bool:
    """Return True when the reCAPTCHA secret is the default placeholder."""
    secret = os.environ.get("RECAPTCHA_SECRET_KEY", "")
    return secret == "your-recaptcha-secret-key"


def _extension_for_upload(file: UploadFile) -> str | None:
    """Return allowed extension for upload mime-type, else None."""
    if not file.content_type:
        return None
    return _ALLOWED_IMAGE_TYPES.get(file.content_type.lower())


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
    display_name = body.display_name.strip()
    if not display_name:
        return JSONResponse(
            status_code=400,
            content={"data": None, "error": "Display name is required"},
        )
    if len(display_name) > 120:
        return JSONResponse(
            status_code=400,
            content={"data": None, "error": "Display name must be 120 characters or fewer"},
        )

    user = User(
        email=body.email,
        display_name=display_name,
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


@router.post("/register-business")
async def register_business(body: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new business-owner account and return a JWT."""
    if not _is_recaptcha_placeholder():
        captcha_ok = await verify_recaptcha(body.captcha_token)
        if not captcha_ok:
            return JSONResponse(
                status_code=400,
                content={"data": None, "error": "reCAPTCHA verification failed"},
            )

    if not _PASSWORD_PATTERN.match(body.password):
        return JSONResponse(
            status_code=400,
            content={
                "data": None,
                "error": "Password must be at least 8 characters with at least one digit",
            },
        )

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        return JSONResponse(
            status_code=409,
            content={"data": None, "error": "Email is already registered"},
        )

    display_name = body.display_name.strip()
    if not display_name:
        return JSONResponse(
            status_code=400,
            content={"data": None, "error": "Display name is required"},
        )
    if len(display_name) > 120:
        return JSONResponse(
            status_code=400,
            content={"data": None, "error": "Display name must be 120 characters or fewer"},
        )

    user = User(
        email=body.email,
        display_name=display_name,
        password_hash=hash_password(body.password),
        role="business_owner",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_jwt_token(user.id, user.email, user.role)
    return {"data": {"token": token, "user": _user_dict(user)}, "error": None}


@router.post("/login")
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT."""
    if not _is_recaptcha_placeholder():
        captcha_ok = await verify_recaptcha(body.captcha_token)
        if not captcha_ok:
            return JSONResponse(
                status_code=400,
                content={"data": None, "error": "reCAPTCHA verification failed"},
            )

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


class UpdateProfileRequest(BaseModel):
    """Payload for updating the authenticated user's profile fields."""

    display_name: str | None = None
    profile_image_url: str | None = None


@router.put("/me")
async def update_me(
    body: UpdateProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update profile fields for the currently authenticated user."""
    if body.display_name is not None:
        display_name = body.display_name.strip()
        if not display_name:
            return JSONResponse(
                status_code=400,
                content={"data": None, "error": "Display name cannot be empty"},
            )
        if len(display_name) > 120:
            return JSONResponse(
                status_code=400,
                content={"data": None, "error": "Display name must be 120 characters or fewer"},
            )
        current_user.display_name = display_name

    if body.profile_image_url is not None:
        value = body.profile_image_url.strip()
        if value and not value.startswith(("http://", "https://")):
            return JSONResponse(
                status_code=400,
                content={"data": None, "error": "Profile image URL must start with http:// or https://"},
            )
        current_user.profile_image_url = value or None

    db.commit()
    db.refresh(current_user)
    return {"data": _user_dict(current_user), "error": None}


@router.post("/me/avatar")
async def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload and save a profile avatar image for the authenticated user."""
    ext = _extension_for_upload(file)
    if not ext:
        return JSONResponse(
            status_code=400,
            content={
                "data": None,
                "error": "Unsupported image type. Use JPEG, PNG, or WEBP.",
            },
        )

    content = await file.read()
    if not content:
        return JSONResponse(
            status_code=400,
            content={"data": None, "error": "Uploaded file is empty"},
        )
    if len(content) > _MAX_IMAGE_BYTES:
        return JSONResponse(
            status_code=400,
            content={"data": None, "error": "Image is too large (max 5 MB)"},
        )

    filename = f"{current_user.id}-{uuid4().hex}{ext}"
    saved_path = _UPLOAD_DIR / filename
    with open(saved_path, "wb") as out:
        out.write(content)

    avatar_url = str(request.url_for("uploads", path=f"profile-images/{filename}"))
    current_user.profile_image_url = avatar_url
    db.commit()
    db.refresh(current_user)
    return {"data": _user_dict(current_user), "error": None}
