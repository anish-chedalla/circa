"""FastAPI router for business owner dashboard: edit business info and manage deals."""

import re
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.business import Business
from backend.services.deal_manager import create_deal, get_active_deals, soft_delete_deal
from backend.utils.auth import get_current_user

router = APIRouter(prefix="/api/owner", tags=["owner"])

_PHONE_RE = re.compile(r"^\+?[1-9]\d{1,14}$")
_URL_RE = re.compile(r"^https?://\S+$")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class UpdateBusinessRequest(BaseModel):
    """Fields a business owner may update."""
    description: str | None = None
    phone: str | None = None
    website: str | None = None
    hours: dict | None = None


class CreateDealRequest(BaseModel):
    """Payload for creating a new deal."""
    title: str
    description: str | None = None
    expiry_date: date | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_owner_business(db: Session, user_id: int) -> Business | None:
    """Return the business claimed by the given user, or None."""
    return db.query(Business).filter_by(owner_id=user_id, claimed=True).first()


def _serialize_deal(deal) -> dict:
    """Serialize a Deal ORM object."""
    return {
        "id": deal.id,
        "title": deal.title,
        "description": deal.description,
        "expiry_date": deal.expiry_date.isoformat() if deal.expiry_date else None,
        "is_active": deal.is_active,
        "created_at": deal.created_at.isoformat() if deal.created_at else None,
    }


def _serialize_business(biz: Business) -> dict:
    """Serialize a Business ORM object for the owner dashboard."""
    return {
        "id": biz.id, "name": biz.name, "category": biz.category,
        "address": biz.address, "city": biz.city, "zip": biz.zip,
        "phone": biz.phone, "website": biz.website, "description": biz.description,
        "hours": biz.hours, "avg_rating": biz.avg_rating, "review_count": biz.review_count,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/business")
def get_owner_business(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Return the business owned/claimed by the current user."""
    biz = _get_owner_business(db, current_user.id)
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "No claimed business found"})
    deals = get_active_deals(db, biz.id)
    result = _serialize_business(biz)
    result["deals"] = [_serialize_deal(d) for d in deals]
    return {"data": result, "error": None}


@router.put("/business")
def update_owner_business(
    body: UpdateBusinessRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update the owner's business description, phone, website, or hours."""
    biz = _get_owner_business(db, current_user.id)
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "No claimed business found"})

    if body.phone is not None and body.phone != "":
        if not _PHONE_RE.match(body.phone):
            return JSONResponse(status_code=400, content={"data": None, "error": "Invalid phone format"})
        biz.phone = body.phone
    elif body.phone == "":
        biz.phone = None

    if body.website is not None and body.website != "":
        if not _URL_RE.match(body.website):
            return JSONResponse(status_code=400, content={"data": None, "error": "Invalid website URL"})
        biz.website = body.website
    elif body.website == "":
        biz.website = None

    if body.description is not None:
        biz.description = body.description
    if body.hours is not None:
        biz.hours = body.hours

    db.commit()
    db.refresh(biz)
    return {"data": _serialize_business(biz), "error": None}


@router.post("/deals")
def post_deal(
    body: CreateDealRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new deal for the owner's business."""
    biz = _get_owner_business(db, current_user.id)
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "No claimed business found"})
    try:
        deal = create_deal(db, biz.id, body.title, body.description, body.expiry_date)
        db.commit()
        db.refresh(deal)
        return {"data": _serialize_deal(deal), "error": None}
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"data": None, "error": str(exc)})


@router.delete("/deals/{deal_id}")
def delete_deal(
    deal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Soft-delete a deal belonging to the owner's business."""
    biz = _get_owner_business(db, current_user.id)
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "No claimed business found"})
    deleted = soft_delete_deal(db, deal_id, biz.id)
    if not deleted:
        return JSONResponse(status_code=403, content={"data": None, "error": "Deal not found or not authorized"})
    db.commit()
    return {"data": {"message": "Deal removed"}, "error": None}
