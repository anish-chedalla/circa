"""FastAPI router for business owner dashboard: edit business info and manage deals."""

import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.business import Business
from backend.models.business_event import BusinessEvent
from backend.models.deal import Deal
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


class CreateListingRequest(BaseModel):
    """Payload for creating a new business listing pending admin approval."""
    name: str
    category: str
    address: str | None = None
    city: str
    state: str
    zip: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    website: str | None = None
    description: str | None = None
    hours: dict | None = None


class GeocodePreviewRequest(BaseModel):
    """Payload for previewing listing coordinates from address data."""
    address: str | None = None
    city: str
    state: str
    zip: str | None = None


class ReverseGeocodeRequest(BaseModel):
    """Payload for reverse geocoding from map coordinates."""

    lat: float
    lng: float


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_owner_business(db: Session, user_id: int) -> Business | None:
    """Return the business claimed by the given user, or None."""
    return db.query(Business).filter_by(owner_id=user_id, claimed=True).first()


def _list_owner_businesses(db: Session, user_id: int) -> list[Business]:
    """Return all businesses owned by the user, newest first."""
    return (
        db.query(Business)
        .filter(Business.owner_id == user_id)
        .order_by(Business.created_at.desc(), Business.id.desc())
        .all()
    )


def _resolve_owner_business(
    db: Session,
    user_id: int,
    business_id: int | None = None,
) -> Business | None:
    """Resolve a target business for owner actions, with optional explicit id."""
    if business_id is not None:
        return (
            db.query(Business)
            .filter(Business.owner_id == user_id, Business.id == business_id)
            .first()
        )

    claimed = _get_owner_business(db, user_id)
    if claimed:
        return claimed
    return (
        db.query(Business)
        .filter(Business.owner_id == user_id)
        .order_by(Business.created_at.desc(), Business.id.desc())
        .first()
    )


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
        "address": biz.address, "city": biz.city, "state": biz.state, "zip": biz.zip,
        "lat": biz.lat, "lng": biz.lng,
        "phone": biz.phone, "website": biz.website, "description": biz.description,
        "hours": biz.hours, "avg_rating": biz.avg_rating, "review_count": biz.review_count,
        "listing_status": biz.listing_status, "rejection_reason": biz.rejection_reason,
    }


def _serialize_business_summary(biz: Business) -> dict:
    """Serialize a compact business record for selectors/history lists."""
    return {
        "id": biz.id,
        "name": biz.name,
        "category": biz.category,
        "city": biz.city,
        "state": biz.state,
        "listing_status": biz.listing_status, "rejection_reason": biz.rejection_reason,
        "claimed": biz.claimed,
        "created_at": biz.created_at.isoformat() if biz.created_at else None,
    }


def _serialize_listing_history(biz: Business) -> dict:
    """Serialize listing history rows for owner dashboard tables."""
    return {
        "id": biz.id,
        "name": biz.name,
        "category": biz.category,
        "city": biz.city,
        "state": biz.state,
        "listing_status": biz.listing_status, "rejection_reason": biz.rejection_reason,
        "claimed": biz.claimed,
        "created_at": biz.created_at.isoformat() if biz.created_at else None,
        "updated_at": biz.updated_at.isoformat() if biz.updated_at else None,
    }


def _owner_listing(db: Session, user_id: int) -> Business | None:
    """Return the most recently updated listing created by this owner account, if any."""
    return (
        db.query(Business)
        .filter(Business.owner_id == user_id)
        .order_by(Business.updated_at.desc(), Business.id.desc())
        .first()
    )


def _build_owner_analytics(
    db: Session,
    business_id: int,
    days: int,
) -> dict:
    """Aggregate tracked business events into chart-ready owner analytics."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days - 1)
    events = (
        db.query(BusinessEvent)
        .filter(BusinessEvent.business_id == business_id, BusinessEvent.created_at >= since)
        .order_by(BusinessEvent.created_at.asc())
        .all()
    )
    total_events = len(events)
    by_type_counter: Counter[str] = Counter()
    daily_events_map: defaultdict[str, int] = defaultdict(int)

    for event in events:
        by_type_counter[event.event_type] += 1
        day_key = event.created_at.astimezone(timezone.utc).date().isoformat()
        daily_events_map[day_key] += 1

    daily_events: list[dict] = []
    for offset in range(days):
        day = (since.date() + timedelta(days=offset)).isoformat()
        daily_events.append({"date": day, "events": daily_events_map.get(day, 0)})

    by_type = [
        {"event_type": event_type, "count": count}
        for event_type, count in by_type_counter.items()
    ]
    by_type.sort(key=lambda row: row["count"], reverse=True)

    return {
        "days": days,
        "total_events": total_events,
        "detail_views": by_type_counter.get("detail_view", 0),
        "website_clicks": by_type_counter.get("website_click", 0),
        "save_clicks": by_type_counter.get("save_click", 0),
        "phone_clicks": by_type_counter.get("phone_click", 0),
        "daily_events": daily_events,
        "by_event_type": by_type,
    }


def _geocode_listing_address(
    address: str | None,
    city: str,
    state: str,
    zip_code: str | None,
) -> tuple[float | None, float | None]:
    """Best-effort geocode via Nominatim; returns (None, None) when unavailable."""
    parts = [part for part in [address, city, state, zip_code, "USA"] if part]
    query = ", ".join(parts)
    if not query.strip():
        return None, None

    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": query, "format": "json", "limit": 1},
                headers={"User-Agent": "circa-owner-listings/1.0"},
            )
        if response.status_code != 200:
            return None, None
        payload = response.json()
        if not payload:
            return None, None
        return float(payload[0]["lat"]), float(payload[0]["lon"])
    except Exception:
        return None, None


def _reverse_geocode_listing(lat: float, lng: float) -> dict | None:
    """Reverse geocode map coordinates into address parts."""
    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "jsonv2", "addressdetails": 1},
                headers={"User-Agent": "circa-owner-listings/1.0"},
            )
        if response.status_code != 200:
            return None
        payload = response.json()
        address = payload.get("address", {})
        city = address.get("city") or address.get("town") or address.get("village")
        state = address.get("state")
        postcode = address.get("postcode")
        road = address.get("road")
        house_number = address.get("house_number")
        line = " ".join(part for part in [house_number, road] if part).strip() or None
        if not city or not state:
            return None
        return {
            "address": line,
            "city": city,
            "state": state[:2].upper() if len(state) >= 2 else state.upper(),
            "zip": postcode,
            "lat": lat,
            "lng": lng,
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/business")
def get_owner_business(
    business_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return the business owned/claimed by the current user."""
    biz = _resolve_owner_business(db, current_user.id, business_id)
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "No claimed business found"})
    deals = get_active_deals(db, biz.id)
    result = _serialize_business(biz)
    result["deals"] = [_serialize_deal(d) for d in deals]
    return {"data": result, "error": None}


@router.get("/dashboard")
def get_owner_dashboard(
    business_id: int | None = Query(default=None),
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return owner businesses, selected business, listing history, and analytics."""
    businesses = _list_owner_businesses(db, current_user.id)
    if not businesses:
        return {
            "data": {
                "businesses": [],
                "selected_business": None,
                "listing_history": [],
                "analytics": None,
            },
            "error": None,
        }

    selected = _resolve_owner_business(db, current_user.id, business_id)
    if not selected:
        selected = businesses[0]
    selected_deals = get_active_deals(db, selected.id)
    selected_payload = _serialize_business(selected)
    selected_payload["deals"] = [_serialize_deal(d) for d in selected_deals]

    return {
        "data": {
            "businesses": [_serialize_business_summary(b) for b in businesses],
            "selected_business": selected_payload,
            "listing_history": [_serialize_listing_history(b) for b in businesses],
            "analytics": _build_owner_analytics(db, selected.id, days),
        },
        "error": None,
    }


@router.get("/businesses")
def get_owner_businesses_list(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Return all businesses belonging to this owner."""
    businesses = _list_owner_businesses(db, current_user.id)
    return {"data": [_serialize_business_summary(b) for b in businesses], "error": None}


@router.get("/listing")
def get_owner_listing(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Return the owner's submitted listing, including pending/rejected statuses."""
    listing = _owner_listing(db, current_user.id)
    if not listing:
        return {"data": None, "error": None}
    return {"data": _serialize_business(listing), "error": None}


@router.post("/listing")
def create_owner_listing(
    body: CreateListingRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new business listing for a business owner; admin must approve it."""
    if current_user.role not in ("business_owner", "admin"):
        return JSONResponse(
            status_code=403,
            content={"data": None, "error": "Business owner account required"},
        )

    if body.category not in (
        "Restaurants",
        "Coffee Shops",
        "Retail/Shopping",
        "Health & Wellness",
        "Arts & Entertainment",
        "Professional Services",
        "Home Services",
        "Fitness & Recreation",
    ):
        return JSONResponse(status_code=400, content={"data": None, "error": "Invalid category"})

    if body.phone and not _PHONE_RE.match(body.phone):
        return JSONResponse(status_code=400, content={"data": None, "error": "Invalid phone format"})

    if body.website and not _URL_RE.match(body.website):
        return JSONResponse(status_code=400, content={"data": None, "error": "Invalid website URL"})

    state = body.state.strip().upper()
    if len(state) != 2:
        return JSONResponse(status_code=400, content={"data": None, "error": "State must be a 2-letter code"})

    lat = body.lat
    lng = body.lng
    if lat is None or lng is None:
        lat, lng = _geocode_listing_address(body.address, body.city.strip(), state, body.zip)

    biz = Business(
        name=body.name.strip(),
        category=body.category,
        address=body.address,
        city=body.city.strip(),
        state=state,
        zip=body.zip,
        lat=lat,
        lng=lng,
        phone=body.phone,
        website=body.website,
        description=body.description,
        hours=body.hours,
        owner_id=current_user.id,
        claimed=False,
        listing_status="pending",
    )
    db.add(biz)
    db.commit()
    db.refresh(biz)
    return {"data": _serialize_business(biz), "error": None}


@router.put("/listing/{listing_id}/resubmit")
def resubmit_owner_listing(
    listing_id: int,
    body: CreateListingRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update an owner listing and resubmit it for admin review."""
    listing = (
        db.query(Business)
        .filter(Business.id == listing_id, Business.owner_id == current_user.id)
        .first()
    )
    if not listing:
        return JSONResponse(status_code=404, content={"data": None, "error": "Listing not found"})

    state = body.state.strip().upper()
    if len(state) != 2:
        return JSONResponse(status_code=400, content={"data": None, "error": "State must be a 2-letter code"})
    if body.category not in (
        "Restaurants",
        "Coffee Shops",
        "Retail/Shopping",
        "Health & Wellness",
        "Arts & Entertainment",
        "Professional Services",
        "Home Services",
        "Fitness & Recreation",
    ):
        return JSONResponse(status_code=400, content={"data": None, "error": "Invalid category"})
    if body.phone and not _PHONE_RE.match(body.phone):
        return JSONResponse(status_code=400, content={"data": None, "error": "Invalid phone format"})
    if body.website and not _URL_RE.match(body.website):
        return JSONResponse(status_code=400, content={"data": None, "error": "Invalid website URL"})

    lat = body.lat
    lng = body.lng
    if lat is None or lng is None:
        lat, lng = _geocode_listing_address(body.address, body.city.strip(), state, body.zip)

    listing.name = body.name.strip()
    listing.category = body.category
    listing.address = body.address
    listing.city = body.city.strip()
    listing.state = state
    listing.zip = body.zip
    listing.lat = lat
    listing.lng = lng
    listing.phone = body.phone
    listing.website = body.website
    listing.description = body.description
    listing.hours = body.hours
    listing.listing_status = "pending"
    listing.rejection_reason = None

    db.commit()
    db.refresh(listing)
    return {"data": _serialize_business(listing), "error": None}


@router.post("/geocode-preview")
def geocode_preview(body: GeocodePreviewRequest, current_user=Depends(get_current_user)):
    """Preview map coordinates for a draft listing address."""
    if current_user.role not in ("business_owner", "admin"):
        return JSONResponse(
            status_code=403,
            content={"data": None, "error": "Business owner account required"},
        )

    state = body.state.strip().upper()
    if len(state) != 2:
        return JSONResponse(status_code=400, content={"data": None, "error": "State must be a 2-letter code"})

    lat, lng = _geocode_listing_address(body.address, body.city.strip(), state, body.zip)
    if lat is None or lng is None:
        return JSONResponse(status_code=404, content={"data": None, "error": "Could not geocode this address"})
    return {"data": {"lat": lat, "lng": lng}, "error": None}


@router.post("/reverse-geocode")
def reverse_geocode_from_map(
    body: ReverseGeocodeRequest,
    current_user=Depends(get_current_user),
):
    """Return address fields for a selected map point."""
    if current_user.role not in ("business_owner", "admin"):
        return JSONResponse(
            status_code=403,
            content={"data": None, "error": "Business owner account required"},
        )
    result = _reverse_geocode_listing(body.lat, body.lng)
    if not result:
        return JSONResponse(status_code=404, content={"data": None, "error": "Could not reverse geocode this point"})
    return {"data": result, "error": None}


@router.put("/business")
def update_owner_business(
    body: UpdateBusinessRequest,
    business_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Update the owner's business description, phone, website, or hours."""
    biz = _resolve_owner_business(db, current_user.id, business_id)
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
    business_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new deal for the owner's business."""
    biz = _resolve_owner_business(db, current_user.id, business_id)
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
    business_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Soft-delete a deal belonging to the owner's business."""
    biz = _resolve_owner_business(db, current_user.id, business_id)
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "No claimed business found"})
    deal = db.query(Deal).filter(Deal.id == deal_id).first()
    if not deal or deal.business_id != biz.id:
        return JSONResponse(status_code=403, content={"data": None, "error": "Deal not found or not authorized"})
    deleted = soft_delete_deal(db, deal_id, biz.id)
    if not deleted:
        return JSONResponse(status_code=403, content={"data": None, "error": "Deal not found or not authorized"})
    db.commit()
    return {"data": {"message": "Deal removed"}, "error": None}
