"""
Intelligent feature algorithms for the Circa platform.

=====================================================================
Algorithm 1 — Hidden Gems Scorer
=====================================================================
Identifies underappreciated local businesses using three signals:

    score = avg_rating × log10(1 + review_count) × recency_factor

Where:
    recency_factor = 1 / (1 + days_since_last_review / 30)

Rationale:
  - avg_rating      : base quality signal — only well-rated places surface
  - log10(1 + count): logarithmic review count so no single viral business
                      dominates; a jump from 0→5 reviews matters more than
                      50→55 reviews
  - recency_factor  : decays smoothly toward 0 as the last review ages.
                      A place reviewed yesterday scores near 1.0; one with
                      no review in 6 months scores ≈ 0.14.

Minimum threshold: 2 reviews required to qualify.

=====================================================================
Algorithm 2 — Content-Based Recommendations
=====================================================================
Recommends businesses based on each user's saved favorites:

    score = (shared_category_count × 2) + avg_rating + (has_active_deal × 1)

Where:
  - shared_category_count: how many of the user's favorites share the
                           candidate's category (weighted 2× to strongly
                           favour taste profile alignment)
  - avg_rating            : candidate quality as a decimal bonus
  - has_active_deal       : 1-point bonus for businesses with active deals

Fallback: If the user has fewer than 2 favorites, returns Hidden Gems
results instead (city=None, same limit).
"""

import math
from datetime import date, datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.business import Business
from backend.models.deal import Deal
from backend.models.favorite import Favorite
from backend.models.review import Review


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_hidden_gems(db: Session, city: str | None = None, limit: int = 10) -> list[dict]:
    """
    Return the top `limit` Hidden Gem businesses scored by the formula above.

    Parameters:
        db   : SQLAlchemy session.
        city : Optional city filter (exact match, case-sensitive).
        limit: Maximum number of results to return.

    Returns:
        List of business dicts ordered by hidden-gems score descending.
        Each dict includes an extra ``score`` field (2 decimal places).
    """
    candidates = _query_gem_candidates(db, city)
    last_review_map = _last_review_dates(db, [b.id for b in candidates])
    active_deal_ids = _businesses_with_active_deals(db, [b.id for b in candidates])

    scored = [
        _score_gem(b, last_review_map.get(b.id), active_deal_ids)
        for b in candidates
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def get_recommendations(db: Session, user_id: int, limit: int = 10) -> tuple[list[dict], bool]:
    """
    Return personalised business recommendations for a user.

    Parameters:
        db     : SQLAlchemy session.
        user_id: ID of the authenticated user.
        limit  : Maximum number of results to return.

    Returns:
        Tuple of (results list, fallback_used bool).
        If the user has fewer than 2 favorites, falls back to Hidden Gems
        and returns fallback_used=True.
    """
    fav_ids = _user_favorite_ids(db, user_id)
    if len(fav_ids) < 2:
        return get_hidden_gems(db, limit=limit), True

    category_freq = _category_frequency(db, fav_ids)
    candidates = _recommendation_candidates(db, fav_ids)
    active_deal_ids = _businesses_with_active_deals(db, [b.id for b in candidates])

    scored = [
        _score_recommendation(b, category_freq, active_deal_ids)
        for b in candidates
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit], False


# ---------------------------------------------------------------------------
# Hidden Gems helpers
# ---------------------------------------------------------------------------

def _query_gem_candidates(db: Session, city: str | None) -> list[Business]:
    """Return businesses with at least 2 reviews, optionally filtered by city."""
    q = db.query(Business).filter(Business.review_count >= 2)
    if city:
        q = q.filter(Business.city == city)
    return q.all()


def _last_review_dates(db: Session, biz_ids: list[int]) -> dict[int, datetime]:
    """Return a map of business_id → most recent review datetime."""
    if not biz_ids:
        return {}
    rows = (
        db.query(Review.business_id, func.max(Review.created_at))
        .filter(Review.business_id.in_(biz_ids))
        .group_by(Review.business_id)
        .all()
    )
    return {row[0]: row[1] for row in rows}


def _score_gem(biz: Business, last_review_dt: datetime | None, active_deal_ids: set[int]) -> dict:
    """Compute the hidden-gems score for a single business."""
    recency = _recency_factor(last_review_dt)
    raw_score = biz.avg_rating * math.log10(1 + biz.review_count) * recency
    return _serialize_biz(biz, active_deal_ids, round(raw_score, 4))


def _recency_factor(last_dt: datetime | None) -> float:
    """Return a recency factor in (0, 1] based on days since last review."""
    if last_dt is None:
        return 0.0
    now = datetime.now(timezone.utc)
    # Make last_dt timezone-aware if needed
    if last_dt.tzinfo is None:
        last_dt = last_dt.replace(tzinfo=timezone.utc)
    days = max((now - last_dt).total_seconds() / 86400, 0)
    return 1.0 / (1.0 + days / 30.0)


# ---------------------------------------------------------------------------
# Recommendation helpers
# ---------------------------------------------------------------------------

def _user_favorite_ids(db: Session, user_id: int) -> list[int]:
    """Return the list of business IDs saved by the user."""
    rows = db.query(Favorite.business_id).filter_by(user_id=user_id).all()
    return [r[0] for r in rows]


def _category_frequency(db: Session, fav_ids: list[int]) -> dict[str, int]:
    """Return a frequency map of category → count from the user's favorites."""
    businesses = db.query(Business.category).filter(Business.id.in_(fav_ids)).all()
    freq: dict[str, int] = {}
    for (cat,) in businesses:
        freq[cat] = freq.get(cat, 0) + 1
    return freq


def _recommendation_candidates(db: Session, fav_ids: list[int]) -> list[Business]:
    """Return all businesses NOT already in the user's favorites."""
    return db.query(Business).filter(Business.id.notin_(fav_ids)).all()


def _score_recommendation(
    biz: Business, category_freq: dict[str, int], active_deal_ids: set[int]
) -> dict:
    """Compute the content-based recommendation score for a single business."""
    shared = category_freq.get(biz.category, 0)
    has_deal = 1 if biz.id in active_deal_ids else 0
    raw_score = (shared * 2) + biz.avg_rating + has_deal
    return _serialize_biz(biz, active_deal_ids, round(raw_score, 4))


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _businesses_with_active_deals(db: Session, biz_ids: list[int]) -> set[int]:
    """Return the set of business IDs that currently have at least one active deal."""
    if not biz_ids:
        return set()
    today = date.today()
    rows = (
        db.query(Deal.business_id)
        .filter(
            Deal.business_id.in_(biz_ids),
            Deal.is_active == True,  # noqa: E712
        )
        .filter((Deal.expiry_date == None) | (Deal.expiry_date > today))  # noqa: E711
        .distinct()
        .all()
    )
    return {r[0] for r in rows}


def _serialize_biz(biz: Business, active_deal_ids: set[int], score: float) -> dict:
    """Serialize a Business ORM object for API consumption, adding score."""
    return {
        "id": biz.id,
        "name": biz.name,
        "category": biz.category,
        "city": biz.city,
        "lat": biz.lat,
        "lng": biz.lng,
        "description": biz.description,
        "avg_rating": biz.avg_rating,
        "review_count": biz.review_count,
        "has_active_deals": biz.id in active_deal_ids,
        "google_place_id": biz.google_place_id,
        "google_photo_url": biz.google_photo_url,
        "google_summary": biz.google_summary,
        "google_last_synced_at": (
            biz.google_last_synced_at.isoformat() if biz.google_last_synced_at else None
        ),
        "score": score,
    }
