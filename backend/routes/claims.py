"""FastAPI router for business claim requests: search unclaimed businesses and submit claims."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.business import Business
from backend.models.business_claim import BusinessClaim
from backend.utils.auth import get_current_user
from backend.utils.auth import require_role

router = APIRouter(prefix="/api/claims", tags=["claims"])
_owner_only = Depends(require_role("business_owner"))


class SubmitClaimRequest(BaseModel):
    """Payload for submitting a business claim."""
    business_id: int


def _serialize_claim(claim: BusinessClaim, business: Business | None = None) -> dict:
    """Convert a BusinessClaim ORM object to a JSON-safe dict."""
    result = {
        "id": claim.id,
        "business_id": claim.business_id,
        "user_id": claim.user_id,
        "status": claim.status,
        "submitted_at": claim.submitted_at.isoformat() if claim.submitted_at else None,
    }
    if business:
        result["business_name"] = business.name
        result["business_city"] = business.city
    return result


@router.get("/search")
def search_unclaimed(
    name: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _=_owner_only,
):
    """Return up to 10 unclaimed businesses matching the given name query."""
    results = (
        db.query(Business)
        .filter(
            Business.claimed == False,  # noqa: E712
            func.lower(Business.name).contains(name.lower()),
        )
        .limit(10)
        .all()
    )
    return {
        "data": [
            {
                "id": b.id, "name": b.name, "category": b.category,
                "city": b.city, "address": b.address,
            }
            for b in results
        ],
        "error": None,
    }


@router.post("")
def submit_claim(
    body: SubmitClaimRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=_owner_only,
):
    """Submit a claim request for an unclaimed business."""
    biz = db.query(Business).filter_by(id=body.business_id).first()
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "Business not found"})
    if biz.claimed:
        return JSONResponse(status_code=409, content={"data": None, "error": "This business has already been claimed"})

    existing = (
        db.query(BusinessClaim)
        .filter_by(business_id=body.business_id, user_id=current_user.id, status="pending")
        .first()
    )
    if existing:
        return JSONResponse(status_code=409, content={"data": None, "error": "You already have a pending claim for this business"})

    claim = BusinessClaim(
        business_id=body.business_id,
        user_id=current_user.id,
        status="pending",
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return {"data": _serialize_claim(claim, biz), "error": None}
