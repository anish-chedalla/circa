"""FastAPI router for review endpoints (create, update, list by business)."""

import os

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.business import Business
from backend.services.review_system import create_review, get_reviews_for_business, update_review
from backend.services.verification_system import verify_recaptcha
from backend.utils.auth import get_current_user

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CreateReviewRequest(BaseModel):
    """Payload for creating a new review."""
    business_id: int
    rating: int
    text: str | None = None
    captcha_token: str = ""


class UpdateReviewRequest(BaseModel):
    """Payload for editing an existing review."""
    rating: int | None = None
    text: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_recaptcha_placeholder() -> bool:
    """Return True when the reCAPTCHA secret is the default placeholder."""
    return os.environ.get("RECAPTCHA_SECRET_KEY", "") == "your-recaptcha-secret-key"


def _serialize_review(review) -> dict:
    """Convert a Review ORM object to a JSON-safe dict."""
    return {
        "id": review.id,
        "business_id": review.business_id,
        "rating": review.rating,
        "text": review.text,
        "created_at": review.created_at.isoformat() if review.created_at else None,
        "user": {"id": review.user.id, "email": review.user.email} if review.user else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("")
async def create_review_endpoint(
    body: CreateReviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a review. Requires auth and reCAPTCHA. One review per user per business."""
    if not _is_recaptcha_placeholder():
        ok = await verify_recaptcha(body.captcha_token)
        if not ok:
            return JSONResponse(status_code=400, content={"data": None, "error": "reCAPTCHA failed"})

    if not (1 <= body.rating <= 5):
        return JSONResponse(status_code=400, content={"data": None, "error": "Rating must be 1–5"})

    if body.text and len(body.text) > 1000:
        return JSONResponse(status_code=400, content={"data": None, "error": "Review text exceeds 1000 characters"})

    if not db.query(Business).filter_by(id=body.business_id).first():
        return JSONResponse(status_code=404, content={"data": None, "error": "Business not found"})

    try:
        review = create_review(db, body.business_id, current_user.id, body.rating, body.text)
        db.commit()
        db.refresh(review)
        return {"data": _serialize_review(review), "error": None}
    except IntegrityError:
        return JSONResponse(status_code=409, content={"data": None, "error": "You have already reviewed this business"})


@router.put("/{review_id}")
def update_review_endpoint(
    review_id: int,
    body: UpdateReviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update the authenticated user's review. Only the owner may edit."""
    if body.rating is not None and not (1 <= body.rating <= 5):
        return JSONResponse(status_code=400, content={"data": None, "error": "Rating must be 1–5"})

    try:
        review = update_review(db, review_id, current_user.id, body.rating, body.text)
        db.commit()
        db.refresh(review)
        return {"data": _serialize_review(review), "error": None}
    except PermissionError as exc:
        return JSONResponse(status_code=403, content={"data": None, "error": str(exc)})
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"data": None, "error": str(exc)})


@router.get("/business/{business_id}")
def list_reviews(business_id: int, db: Session = Depends(get_db)):
    """Return all reviews for a given business, newest first."""
    reviews = get_reviews_for_business(db, business_id)
    return {"data": [_serialize_review(r) for r in reviews], "error": None}
