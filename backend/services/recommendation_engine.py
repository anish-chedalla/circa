"""
Recommendation and discovery scoring algorithms for Circa.

Design approach:
1. Query helpers pull candidate rows from SQLAlchemy.
2. Scoring helpers apply deterministic math in Python.
3. Shared serialization keeps API payload shape consistent across features.

This layout is intentionally modular so each step can be tested and tuned
independently without changing unrelated logic.
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
    Return hidden-gem businesses ranked by:
        avg_rating * log10(1 + review_count) * recency_factor

    Why this works:
    - avg_rating rewards quality.
    - logarithmic review term reduces domination by very high-volume businesses.
    - recency_factor rewards currently active businesses.
    """
    # Step 1: pull only businesses that pass the minimum threshold.
    candidates = _query_gem_candidates(db, city)
    candidate_ids = [b.id for b in candidates]

    # Step 2: precompute lookups once (O(n)) to avoid repeated DB calls.
    last_review_map = _last_review_dates(db, candidate_ids)
    active_deal_ids = _businesses_with_active_deals(db, candidate_ids)

    # Step 3: score each candidate with pure helper logic.
    scored = [
        _score_gem(b, last_review_map.get(b.id), active_deal_ids)
        for b in candidates
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def get_recommendations(db: Session, user_id: int, limit: int = 10) -> tuple[list[dict], bool]:
    """
    Return personalized recommendations and a fallback flag.

    Score formula:
        (shared_category_count * 2) + avg_rating + has_active_deal_bonus

    If the user has fewer than 2 favorites, we intentionally fallback to
    Hidden Gems so the UI still has useful results for new users.
    """
    fav_ids = _user_favorite_ids(db, user_id)
    if len(fav_ids) < 2:
        return get_hidden_gems(db, limit=limit), True

    # Build preference profile (category frequency acts as taste vector).
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
    """
    Return businesses eligible for hidden-gems scoring.

    Review threshold is enforced in SQL (review_count >= 2) to reduce
    unnecessary Python-side filtering.
    """
    q = db.query(Business).filter(Business.review_count >= 2)
    if city:
        q = q.filter(Business.city == city)
    return q.all()


def _last_review_dates(db: Session, biz_ids: list[int]) -> dict[int, datetime]:
    """
    Return map of business_id -> most recent review timestamp.

    This map gives O(1) access during scoring and avoids N+1 queries.
    """
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
    """
    Score a single hidden-gem candidate.

    `math.log10(1 + review_count)` compresses raw volume so quality and
    recency remain visible instead of being drowned out by popularity.
    """
    recency = _recency_factor(last_review_dt)
    raw_score = biz.avg_rating * math.log10(1 + biz.review_count) * recency
    return _serialize_biz(biz, active_deal_ids, round(raw_score, 4))


def _recency_factor(last_dt: datetime | None) -> float:
    """
    Convert latest review timestamp to a multiplier in [0, 1].

    - None => 0.0 (no recency signal)
    - very recent => near 1.0
    - older => smoothly decays by days/30
    """
    if last_dt is None:
        return 0.0
    now = datetime.now(timezone.utc)
    # Normalize naive datetimes to UTC before subtraction.
    if last_dt.tzinfo is None:
        last_dt = last_dt.replace(tzinfo=timezone.utc)
    days = max((now - last_dt).total_seconds() / 86400, 0)
    return 1.0 / (1.0 + days / 30.0)


# ---------------------------------------------------------------------------
# Recommendation helpers
# ---------------------------------------------------------------------------

def _user_favorite_ids(db: Session, user_id: int) -> list[int]:
    """Return business IDs favorited by the user."""
    rows = db.query(Favorite.business_id).filter_by(user_id=user_id).all()
    return [r[0] for r in rows]


def _category_frequency(db: Session, fav_ids: list[int]) -> dict[str, int]:
    """
    Build category -> count frequency from user's favorites.

    This compact dictionary acts as the preference model used by scoring.
    """
    businesses = db.query(Business.category).filter(Business.id.in_(fav_ids)).all()
    freq: dict[str, int] = {}
    for (cat,) in businesses:
        freq[cat] = freq.get(cat, 0) + 1
    return freq


def _recommendation_candidates(db: Session, fav_ids: list[int]) -> list[Business]:
    """Return all businesses that are not already in favorites."""
    return db.query(Business).filter(Business.id.notin_(fav_ids)).all()


def _score_recommendation(
    biz: Business, category_freq: dict[str, int], active_deal_ids: set[int]
) -> dict:
    """
    Score one recommendation candidate.

    Weighting is intentionally simple and explainable:
    - category overlap is weighted heavily (`* 2`)
    - business quality adds a continuous bonus (`avg_rating`)
    - active deal adds a small conversion-oriented boost
    """
    shared = category_freq.get(biz.category, 0)
    has_deal = 1 if biz.id in active_deal_ids else 0
    raw_score = (shared * 2) + biz.avg_rating + has_deal
    return _serialize_biz(biz, active_deal_ids, round(raw_score, 4))


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _businesses_with_active_deals(db: Session, biz_ids: list[int]) -> set[int]:
    """
    Return business IDs with at least one currently-active deal.

    Set return type is deliberate for O(1) membership checks during scoring
    and serialization.
    """
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
    """
    Serialize a business to API payload used by both algorithms.

    Centralizing this shape in one helper prevents drift between hidden-gems
    and recommendation responses over time.
    """
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
