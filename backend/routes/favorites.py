"""FastAPI router for favorites: add, remove, and list a user's saved businesses."""

from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.business import Business
from backend.models.favorite import Favorite
from backend.utils.auth import get_current_user

router = APIRouter(prefix="/api/favorites", tags=["favorites"])


# ---------------------------------------------------------------------------
# Serialization helper
# ---------------------------------------------------------------------------

def _serialize_business(biz: Business, favorited: bool = True) -> dict:
    """Convert a Business ORM object to a JSON-safe dict for favorites list."""
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
        "state": biz.state,
        "zip": biz.zip,
        "lat": biz.lat,
        "lng": biz.lng,
        "phone": biz.phone,
        "website": biz.website,
        "description": biz.description,
        "avg_rating": biz.avg_rating,
        "review_count": biz.review_count,
        "has_active_deals": has_active,
        "is_favorited": favorited,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def list_favorites(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Return all businesses saved by the authenticated user."""
    favs = db.query(Favorite).filter_by(user_id=current_user.id).all()
    biz_ids = [f.business_id for f in favs]
    businesses = db.query(Business).filter(Business.id.in_(biz_ids)).all() if biz_ids else []
    return {"data": [_serialize_business(b) for b in businesses], "error": None}


@router.post("/{business_id}")
def add_favorite(
    business_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Add a business to the authenticated user's favorites."""
    biz = db.query(Business).filter_by(id=business_id).first()
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "Business not found"})

    fav = Favorite(user_id=current_user.id, business_id=business_id)
    db.add(fav)
    try:
        db.commit()
        db.refresh(fav)
        return {"data": {"id": fav.id, "business_id": fav.business_id, "created_at": fav.created_at.isoformat()}, "error": None}
    except IntegrityError:
        db.rollback()
        return JSONResponse(status_code=409, content={"data": None, "error": "Already in favorites"})


@router.delete("/{business_id}")
def remove_favorite(
    business_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Remove a business from the authenticated user's favorites."""
    fav = db.query(Favorite).filter_by(user_id=current_user.id, business_id=business_id).first()
    if not fav:
        return JSONResponse(status_code=404, content={"data": None, "error": "Favorite not found"})
    db.delete(fav)
    db.commit()
    return {"data": {"message": "Removed from favorites"}, "error": None}
