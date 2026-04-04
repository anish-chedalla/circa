"""Password hashing, JWT management, and reCAPTCHA verification."""

import os
from datetime import datetime, timedelta, timezone

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return a bcrypt hash of the given plaintext password."""
    return _pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Check a plaintext password against a bcrypt hash."""
    return _pwd_context.verify(password, hashed)


def create_jwt_token(user_id: int, email: str, role: str) -> str:
    """Create a signed JWT containing the user's id, email, and role."""
    secret = os.environ["JWT_SECRET_KEY"]
    algorithm = os.environ.get("JWT_ALGORITHM", "HS256")
    expiry_minutes = int(os.environ.get("JWT_EXPIRY_MINUTES", "1440"))

    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_jwt_token(token: str) -> dict:
    """Decode and validate a JWT, returning its payload dict.

    Raises ``JWTError`` if the token is invalid or expired.
    """
    secret = os.environ["JWT_SECRET_KEY"]
    algorithm = os.environ.get("JWT_ALGORITHM", "HS256")
    return jwt.decode(token, secret, algorithms=[algorithm])


async def verify_recaptcha(token: str) -> bool:
    """Verify a reCAPTCHA response token with Google's API.

    Returns ``True`` when verification succeeds, ``False`` otherwise.
    """
    secret_key = os.environ.get("RECAPTCHA_SECRET_KEY", "")
    if not secret_key:
        return False

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": secret_key, "response": token},
        )

    result = response.json()
    return bool(result.get("success", False))
