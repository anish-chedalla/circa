"""
Review service: create/edit reviews, enforce one-per-user, recompute ratings.

All public functions return ORM objects or raise ValueError/PermissionError.
"""

import bleach
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.business import Business
from backend.models.review import Review


def create_review(db: Session, business_id: int, user_id: int, rating: int, text: str | None) -> Review:
    """
    Create a new review for a business.

    Parameters:
        db: SQLAlchemy session.
        business_id: ID of the business being reviewed.
        user_id: ID of the authenticated user.
        rating: Integer 1–5.
        text: Optional review text (HTML stripped, max 1000 chars).

    Returns:
        The created Review ORM object.

    Raises:
        ValueError: If rating is out of range.
        IntegrityError: If user already reviewed this business (duplicate).
    """
    _validate_rating(rating)
    clean_text = _sanitize_text(text)

    review = Review(
        business_id=business_id,
        user_id=user_id,
        rating=rating,
        text=clean_text,
    )
    db.add(review)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise

    _recompute_rating(db, business_id)
    return review


def update_review(db: Session, review_id: int, user_id: int, rating: int | None, text: str | None) -> Review:
    """
    Update an existing review.

    Parameters:
        db: SQLAlchemy session.
        review_id: ID of the review to update.
        user_id: ID of the authenticated user (must own the review).
        rating: New rating (optional).
        text: New text (optional).

    Returns:
        The updated Review ORM object.

    Raises:
        ValueError: If review not found, user is not owner, or rating is invalid.
    """
    review = db.query(Review).filter_by(id=review_id).first()
    if not review:
        raise ValueError("Review not found")
    if review.user_id != user_id:
        raise PermissionError("You can only edit your own reviews")

    if rating is not None:
        _validate_rating(rating)
        review.rating = rating
    if text is not None:
        review.text = _sanitize_text(text)

    db.flush()
    _recompute_rating(db, review.business_id)
    return review


def get_reviews_for_business(db: Session, business_id: int) -> list[Review]:
    """
    Retrieve all reviews for a business, newest first.

    Parameters:
        db: SQLAlchemy session.
        business_id: ID of the business.

    Returns:
        List of Review ORM objects.
    """
    return (
        db.query(Review)
        .filter_by(business_id=business_id)
        .order_by(Review.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _validate_rating(rating: int) -> None:
    """Raise ValueError if rating is not 1–5."""
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        raise ValueError("Rating must be an integer between 1 and 5")


def _sanitize_text(text: str | None) -> str | None:
    """Strip HTML tags and truncate to 1000 characters."""
    if text is None:
        return None
    cleaned = bleach.clean(text, tags=[], strip=True).strip()
    return cleaned[:1000] if cleaned else None


def _recompute_rating(db: Session, business_id: int) -> None:
    """Recalculate and persist avg_rating and review_count for a business."""
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
