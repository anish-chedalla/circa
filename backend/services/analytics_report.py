"""
Analytics service: platform-wide statistics for the analytics dashboard.

Returns aggregated data about businesses, reviews, deals, and users.
"""

from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.business import Business
from backend.models.deal import Deal
from backend.models.review import Review
from backend.models.user import User


def get_analytics(db: Session) -> dict:
    """
    Compute and return all platform analytics in a single dict.

    Parameters:
        db: SQLAlchemy session.

    Returns:
        Dict with keys: top_rated, most_reviewed, category_counts,
        active_deals_count, total_businesses, total_reviews, total_users.
    """
    return {
        "top_rated": _top_rated(db),
        "most_reviewed": _most_reviewed(db),
        "category_counts": _category_counts(db),
        "active_deals_count": _active_deals_count(db),
        "total_businesses": db.query(func.count(Business.id)).scalar() or 0,
        "total_reviews": db.query(func.count(Review.id)).scalar() or 0,
        "total_users": db.query(func.count(User.id)).scalar() or 0,
    }


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _top_rated(db: Session, limit: int = 10) -> list[dict]:
    """Return the top `limit` businesses by avg_rating (min 1 review)."""
    rows = (
        db.query(Business)
        .filter(Business.review_count >= 1)
        .order_by(Business.avg_rating.desc(), Business.review_count.desc())
        .limit(limit)
        .all()
    )
    return [_biz_summary(b) for b in rows]


def _most_reviewed(db: Session, limit: int = 10) -> list[dict]:
    """Return the top `limit` businesses by review_count."""
    rows = (
        db.query(Business)
        .filter(Business.review_count >= 1)
        .order_by(Business.review_count.desc())
        .limit(limit)
        .all()
    )
    return [_biz_summary(b) for b in rows]


def _category_counts(db: Session) -> dict[str, int]:
    """Return a dict mapping each category to its business count."""
    rows = (
        db.query(Business.category, func.count(Business.id))
        .group_by(Business.category)
        .order_by(func.count(Business.id).desc())
        .all()
    )
    return {row[0]: row[1] for row in rows}


def _active_deals_count(db: Session) -> int:
    """Return the total number of active, non-expired deals."""
    today = date.today()
    return (
        db.query(func.count(Deal.id))
        .filter(
            Deal.is_active == True,  # noqa: E712
        )
        .filter((Deal.expiry_date == None) | (Deal.expiry_date > today))  # noqa: E711
        .scalar()
        or 0
    )


def _biz_summary(biz: Business) -> dict:
    """Return a compact business dict for chart data."""
    return {
        "id": biz.id,
        "name": biz.name,
        "category": biz.category,
        "city": biz.city,
        "avg_rating": biz.avg_rating,
        "review_count": biz.review_count,
    }
