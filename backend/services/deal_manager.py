"""
Deal service: create, soft-delete, and query deals for business owners.

All functions operate on deals belonging to the authenticated owner's business.
"""

from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from backend.models.deal import Deal


def create_deal(
    db: Session,
    business_id: int,
    title: str,
    description: str | None,
    expiry_date: date | None,
) -> Deal:
    """
    Create a new deal for a business.

    Parameters:
        db: SQLAlchemy session.
        business_id: ID of the business posting the deal.
        title: Deal title (max 100 chars).
        description: Optional longer description.
        expiry_date: Optional future expiry date.

    Returns:
        The newly created Deal ORM object.

    Raises:
        ValueError: If title exceeds 100 chars or expiry_date is not in the future.
    """
    _validate_title(title)
    if expiry_date:
        _validate_expiry(expiry_date)

    deal = Deal(
        business_id=business_id,
        title=title.strip(),
        description=description,
        expiry_date=expiry_date,
        is_active=True,
    )
    db.add(deal)
    db.flush()
    return deal


def soft_delete_deal(db: Session, deal_id: int, owner_business_id: int) -> bool:
    """
    Soft-delete a deal by setting is_active=False.

    Parameters:
        db: SQLAlchemy session.
        deal_id: ID of the deal to remove.
        owner_business_id: The business ID the current owner owns.

    Returns:
        True if deleted; False if deal not found or belongs to different business.
    """
    deal = db.query(Deal).filter_by(id=deal_id).first()
    if not deal or deal.business_id != owner_business_id:
        return False
    deal.is_active = False
    db.flush()
    return True


def get_active_deals(db: Session, business_id: int) -> list[Deal]:
    """
    Retrieve all active, non-expired deals for a business.

    Parameters:
        db: SQLAlchemy session.
        business_id: ID of the business.

    Returns:
        List of active Deal ORM objects.
    """
    today = date.today()
    return (
        db.query(Deal)
        .filter(
            Deal.business_id == business_id,
            Deal.is_active == True,  # noqa: E712
        )
        .filter(
            (Deal.expiry_date == None) | (Deal.expiry_date > today)  # noqa: E711
        )
        .order_by(Deal.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Private validators
# ---------------------------------------------------------------------------

def _validate_title(title: str) -> None:
    """Raise ValueError if title is empty or exceeds 100 chars."""
    if not title or not title.strip():
        raise ValueError("Deal title cannot be empty")
    if len(title.strip()) > 100:
        raise ValueError("Deal title cannot exceed 100 characters")


def _validate_expiry(expiry_date: date) -> None:
    """Raise ValueError if expiry_date is not in the future."""
    if expiry_date <= date.today():
        raise ValueError("Expiry date must be a future date")
