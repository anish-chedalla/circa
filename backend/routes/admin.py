"""FastAPI router for admin-only operations: claim approval and review moderation."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.business import Business
from backend.models.business_claim import BusinessClaim
from backend.models.review import Review
from backend.models.user import User
from backend.services.google_places_enrichment import (
    enrich_business_by_id,
    enrich_multiple_businesses,
)
from backend.utils.auth import get_current_user, require_role

router = APIRouter(prefix="/api/admin", tags=["admin"])
_admin = Depends(require_role("admin"))


class ListingRejectRequest(BaseModel):
    """Payload for rejecting a listing with a required reason."""

    reason: str


# ---------------------------------------------------------------------------
# Claims
# ---------------------------------------------------------------------------

@router.get("/claims")
def list_claims(
    status: str = Query("pending"),
    db: Session = Depends(get_db),
    _=_admin,
):
    """Return business claims filtered by status (default: pending)."""
    q = db.query(BusinessClaim)
    if status != "all":
        q = q.filter_by(status=status)
    claims = q.order_by(BusinessClaim.submitted_at.desc()).all()
    return {"data": [_serialize_claim(c, db) for c in claims], "error": None}


@router.post("/claims/{claim_id}/approve")
def approve_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=_admin,
):
    """Approve a pending claim: set business as claimed, promote user to owner."""
    claim = db.query(BusinessClaim).filter_by(id=claim_id).first()
    if not claim:
        return JSONResponse(status_code=404, content={"data": None, "error": "Claim not found"})

    claim.status = "approved"
    claim.reviewed_at = datetime.now(timezone.utc)
    claim.reviewer_id = current_user.id

    db.query(Business).filter_by(id=claim.business_id).update(
        {"claimed": True, "owner_id": claim.user_id}
    )
    db.query(User).filter_by(id=claim.user_id).update({"role": "business_owner"})
    db.commit()
    db.refresh(claim)
    return {"data": _serialize_claim(claim, db), "error": None}


@router.post("/claims/{claim_id}/reject")
def reject_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=_admin,
):
    """Reject a pending claim."""
    claim = db.query(BusinessClaim).filter_by(id=claim_id).first()
    if not claim:
        return JSONResponse(status_code=404, content={"data": None, "error": "Claim not found"})

    claim.status = "rejected"
    claim.reviewed_at = datetime.now(timezone.utc)
    claim.reviewer_id = current_user.id
    db.commit()
    db.refresh(claim)
    return {"data": _serialize_claim(claim, db), "error": None}


# ---------------------------------------------------------------------------
# Review moderation
# ---------------------------------------------------------------------------

@router.get("/reviews")
def list_reviews(db: Session = Depends(get_db), _=_admin):
    """Return all reviews for admin moderation, newest first."""
    reviews = db.query(Review).order_by(Review.created_at.desc()).all()
    return {"data": [_serialize_review(r) for r in reviews], "error": None}


@router.delete("/reviews/{review_id}")
def remove_review(review_id: int, db: Session = Depends(get_db), _=_admin):
    """Hard-delete a review and recompute the business rating."""
    review = db.query(Review).filter_by(id=review_id).first()
    if not review:
        return JSONResponse(status_code=404, content={"data": None, "error": "Review not found"})

    biz_id = review.business_id
    db.delete(review)
    db.flush()
    _recompute_rating(db, biz_id)
    db.commit()
    return {"data": {"message": "Review removed"}, "error": None}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(db: Session = Depends(get_db), _=_admin):
    """Return all registered users."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return {
        "data": [
            {"id": u.id, "email": u.email, "role": u.role,
             "created_at": u.created_at.isoformat() if u.created_at else None,
             "is_active": u.is_active}
            for u in users
        ],
        "error": None,
    }


@router.get("/listings/pending")
def list_pending_listings(db: Session = Depends(get_db), _=_admin):
    """Return pending business listings submitted by business owners."""
    listings = (
        db.query(Business)
        .filter(Business.listing_status == "pending")
        .order_by(Business.created_at.desc())
        .all()
    )
    return {
        "data": [
            {
                "id": b.id,
                "name": b.name,
                "category": b.category,
                "city": b.city,
                "address": b.address,
                "owner_id": b.owner_id,
                "description": b.description,
                "rejection_reason": b.rejection_reason,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in listings
        ],
        "error": None,
    }


@router.post("/listings/{listing_id}/approve")
def approve_listing(listing_id: int, db: Session = Depends(get_db), _=_admin):
    """Approve a pending listing and publish it."""
    listing = db.query(Business).filter_by(id=listing_id).first()
    if not listing:
        return JSONResponse(status_code=404, content={"data": None, "error": "Listing not found"})
    listing.listing_status = "approved"
    listing.claimed = True
    listing.rejection_reason = None
    db.commit()
    return {"data": {"id": listing.id, "status": listing.listing_status}, "error": None}


@router.post("/listings/{listing_id}/reject")
def reject_listing(
    listing_id: int,
    body: ListingRejectRequest,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Reject a pending listing."""
    listing = db.query(Business).filter_by(id=listing_id).first()
    if not listing:
        return JSONResponse(status_code=404, content={"data": None, "error": "Listing not found"})
    reason = body.reason.strip()
    if not reason:
        return JSONResponse(status_code=400, content={"data": None, "error": "Rejection reason is required"})
    listing.listing_status = "rejected"
    listing.rejection_reason = reason
    listing.claimed = False
    db.commit()
    return {
        "data": {"id": listing.id, "status": listing.listing_status, "rejection_reason": listing.rejection_reason},
        "error": None,
    }


# ---------------------------------------------------------------------------
# Google enrichment
# ---------------------------------------------------------------------------

@router.post("/businesses/{business_id}/enrich-google")
def enrich_business_google(
    business_id: int,
    db: Session = Depends(get_db),
    _=_admin,
):
    """Enrich one business with Google Places metadata and cache it."""
    try:
        data = enrich_business_by_id(db, business_id)
    except ValueError as exc:
        return JSONResponse(status_code=404, content={"data": None, "error": str(exc)})
    except Exception as exc:
        return JSONResponse(status_code=400, content={"data": None, "error": str(exc)})
    return {"data": data, "error": None}


@router.post("/businesses/enrich-google")
def enrich_businesses_google(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=_admin,
):
    """Enrich a batch of businesses with Google Places metadata."""
    try:
        data = enrich_multiple_businesses(db, limit=limit)
    except Exception as exc:
        return JSONResponse(status_code=400, content={"data": None, "error": str(exc)})
    return {"data": data, "error": None}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize_claim(claim: BusinessClaim, db: Session) -> dict:
    """Serialize a claim with business name and user email."""
    biz = db.query(Business.name).filter_by(id=claim.business_id).first()
    user = db.query(User.email).filter_by(id=claim.user_id).first()
    return {
        "id": claim.id,
        "business_id": claim.business_id,
        "business_name": biz[0] if biz else None,
        "user_id": claim.user_id,
        "user_email": user[0] if user else None,
        "status": claim.status,
        "claim_message": claim.claim_message,
        "proof_document_urls": claim.proof_document_urls or [],
        "submitted_at": claim.submitted_at.isoformat() if claim.submitted_at else None,
        "reviewed_at": claim.reviewed_at.isoformat() if claim.reviewed_at else None,
    }


def _serialize_review(review: Review) -> dict:
    """Serialize a review with business name and user email for the admin table."""
    biz = review.business
    user = review.user
    return {
        "id": review.id,
        "business_id": review.business_id,
        "business_name": biz.name if biz else None,
        "user_email": user.email if user else None,
        "rating": review.rating,
        "text": review.text,
        "created_at": review.created_at.isoformat() if review.created_at else None,
    }


def _recompute_rating(db: Session, business_id: int) -> None:
    """Recalculate avg_rating and review_count after a review is deleted."""
    result = (
        db.query(func.avg(Review.rating), func.count(Review.id))
        .filter(Review.business_id == business_id)
        .first()
    )
    avg_val = round(float(result[0]), 2) if result[0] else 0.0
    count_val = int(result[1]) if result[1] else 0
    db.query(Business).filter_by(id=business_id).update(
        {"avg_rating": avg_val, "review_count": count_val}
    )
