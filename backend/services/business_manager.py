"""Service layer for business listing queries and filters."""

from datetime import date

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.models.business import Business
from backend.models.deal import Deal

ALLOWED_CATEGORIES: list[str] = [
    "Restaurants",
    "Coffee Shops",
    "Retail/Shopping",
    "Health & Wellness",
    "Arts & Entertainment",
    "Professional Services",
    "Home Services",
    "Fitness & Recreation",
]

_SORT_MAP = {
    "rating": Business.avg_rating.desc(),
    "reviews": Business.review_count.desc(),
    "name": Business.name.asc(),
}


def get_categories() -> list[str]:
    """Return the hardcoded list of allowed business categories."""
    return list(ALLOWED_CATEGORIES)


def get_business_by_id(db: Session, business_id: int) -> Business | None:
    """Fetch a single business by its primary key, or None if not found."""
    return db.query(Business).filter(Business.id == business_id).first()


def get_businesses(
    db: Session,
    category: str | None = None,
    city: str | None = None,
    min_rating: float | None = None,
    has_deals: bool | None = None,
    sort_by: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[Business]:
    """Build a filtered, sorted, paginated query for businesses."""
    query = db.query(Business)
    query = _apply_filters(query, category, city, min_rating, has_deals, search)
    order_clause = _SORT_MAP.get(sort_by or "name", Business.name.asc())
    return query.order_by(order_clause).offset(skip).limit(limit).all()


def _apply_filters(
    query,
    category: str | None,
    city: str | None,
    min_rating: float | None,
    has_deals: bool | None,
    search: str | None,
):
    """Apply optional where-clauses to a business query."""
    if category:
        query = query.filter(Business.category == category)
    if city:
        query = query.filter(Business.city == city)
    if min_rating is not None:
        query = query.filter(Business.avg_rating >= min_rating)
    if has_deals:
        query = _filter_active_deals(query)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Business.name.ilike(pattern), Business.description.ilike(pattern))
        )
    return query


def _filter_active_deals(query):
    """Join with deals to find businesses that have at least one active deal."""
    today = date.today()
    return query.join(Deal).filter(
        Deal.is_active.is_(True),
        or_(Deal.expiry_date.is_(None), Deal.expiry_date > today),
    )
