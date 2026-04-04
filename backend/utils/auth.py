"""FastAPI dependencies for authentication and role-based authorization."""

from typing import Callable

from fastapi import Depends, Header
from fastapi.responses import JSONResponse
from jose import JWTError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from backend.database import get_db
from backend.models.user import User
from backend.services.verification_system import decode_jwt_token


def _extract_bearer_token(authorization: str) -> str:
    """Parse a raw Authorization header and return the token portion."""
    if not authorization.startswith("Bearer "):
        raise ValueError("Missing Bearer prefix")
    return authorization[len("Bearer "):]


async def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that extracts and validates the JWT from the request.

    Returns the corresponding ``User`` row or raises HTTP 401.
    """
    try:
        token = _extract_bearer_token(authorization)
        payload = decode_jwt_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=401,
            detail={"data": None, "error": "Invalid or expired token"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail={"data": None, "error": "User not found or inactive"},
        )
    return user


def require_role(role: str) -> Callable:
    """Return a dependency that enforces the given role on the current user.

    Usage::

        @router.get("/admin-only")
        async def admin_only(user: User = Depends(require_role("admin"))):
            ...
    """

    async def _role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        """Verify the authenticated user has the required role."""
        if current_user.role != role:
            raise HTTPException(
                status_code=403,
                detail={"data": None, "error": "Insufficient permissions"},
            )
        return current_user

    return _role_checker
