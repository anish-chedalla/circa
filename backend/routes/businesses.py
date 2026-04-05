"""FastAPI router for business listing endpoints."""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.business import Business
from backend.services.business_manager import (
    ALLOWED_CATEGORIES,
    get_business_by_id,
    get_businesses,
    get_categories,
)
from backend.services.recommendation_engine import get_hidden_gems

router = APIRouter(prefix="/api/businesses", tags=["businesses"])


@router.get("")
def list_businesses(
    category: Optional[str] = None,
    city: Optional[str] = None,
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    has_deals: Optional[bool] = None,
    sort_by: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Return a paginated list of businesses with optional filters."""
    error = _validate_list_params(category, min_rating)
    if error:
        return JSONResponse(status_code=400, content={"data": None, "error": error})

    results = get_businesses(
        db, category, city, min_rating, has_deals, sort_by, search, skip, limit
    )
    return {"data": [_serialize_business(b) for b in results], "error": None}


@router.get("/categories")
def list_categories():
    """Return all allowed business categories."""
    return {"data": get_categories(), "error": None}


@router.get("/hidden-gems")
def hidden_gems(
    city: Optional[str] = None,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Return Hidden Gems scored by: avg_rating × log10(1+reviews) × recency_factor."""
    results = get_hidden_gems(db, city=city, limit=limit)
    return {"data": results, "error": None}


@router.get("/{business_id}")
def get_business_detail(business_id: int, db: Session = Depends(get_db)):
    """Return a single business with nested reviews and active deals."""
    business = get_business_by_id(db, business_id)
    if not business:
        return JSONResponse(
            status_code=404, content={"data": None, "error": "Business not found"}
        )
    return {"data": _serialize_business_detail(business), "error": None}


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_list_params(
    category: str | None, min_rating: float | None
) -> str | None:
    """Return an error message if query params are invalid, else None."""
    if category and category not in ALLOWED_CATEGORIES:
        return f"Invalid category. Must be one of: {', '.join(ALLOWED_CATEGORIES)}"
    if min_rating is not None and not (0 <= min_rating <= 5):
        return "min_rating must be between 0 and 5"
    return None


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _serialize_business(biz: Business) -> dict:
    """Convert a Business ORM object to a JSON-safe dict for list views."""
    today = date.today()
    has_active = any(
        d.is_active and (d.expiry_date is None or d.expiry_date > today)
        for d in biz.deals
    )
    return {
        "id": biz.id,
        "name": biz.name,
        "category": biz.category,
        "address": biz.address,
        "city": biz.city,
        "zip": biz.zip,
        "lat": biz.lat,
        "lng": biz.lng,
        "phone": biz.phone,
        "website": biz.website,
        "description": biz.description,
        "google_place_id": biz.google_place_id,
        "google_photo_url": biz.google_photo_url,
        "google_summary": biz.google_summary,
        "google_last_synced_at": (
            biz.google_last_synced_at.isoformat() if biz.google_last_synced_at else None
        ),
        "hours": biz.hours,
        "is_chain": biz.is_chain,
        "avg_rating": biz.avg_rating,
        "review_count": biz.review_count,
        "claimed": biz.claimed,
        "has_active_deals": has_active,
    }


def _serialize_business_detail(biz: Business) -> dict:
    """Convert a Business ORM object to a detailed dict with reviews and deals."""
    today = date.today()
    base = _serialize_business(biz)
    base["reviews"] = [_serialize_review(r) for r in biz.reviews]
    base["deals"] = [
        _serialize_deal(d)
        for d in biz.deals
        if d.is_active and (d.expiry_date is None or d.expiry_date > today)
    ]
    return base


def _serialize_review(review) -> dict:
    """Convert a Review ORM object to a JSON-safe dict."""
    return {
        "id": review.id,
        "rating": review.rating,
        "text": review.text,
        "created_at": review.created_at.isoformat() if review.created_at else None,
        "user": {
            "id": review.user.id,
            "email": review.user.email,
        } if review.user else None,
    }


def _serialize_deal(deal) -> dict:
    """Convert a Deal ORM object to a JSON-safe dict."""
    return {
        "id": deal.id,
        "title": deal.title,
        "description": deal.description,
        "expiry_date": deal.expiry_date.isoformat() if deal.expiry_date else None,
        "is_active": deal.is_active,
    }
