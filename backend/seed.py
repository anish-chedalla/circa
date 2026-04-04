"""Seed script to load businesses.json into the Supabase PostgreSQL database.

Also creates pre-seeded demo accounts for all three roles.

Usage:
    python -m backend.seed
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from passlib.context import CryptContext

from backend.database import Base, SessionLocal, engine
from backend.models.business import Business
from backend.models.business_claim import BusinessClaim
from backend.models.deal import Deal
from backend.models.review import Review
from backend.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "businesses.json"

DEMO_ACCOUNTS = [
    {"email": "demo@example.com", "password": "Demo1234", "role": "user"},
    {"email": "owner@example.com", "password": "Owner1234", "role": "business_owner"},
    {"email": "admin@example.com", "password": "Admin1234", "role": "admin"},
]


def _load_businesses_json() -> list[dict]:
    """Read and parse the businesses.json seed file."""
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _create_tables() -> None:
    """Create all tables if they do not already exist."""
    import backend.models  # noqa: F401 — ensure all models are registered

    Base.metadata.create_all(bind=engine)


def _seed_users(session) -> dict[str, int]:
    """Create demo user accounts. Returns a mapping of email to user id."""
    email_to_id: dict[str, int] = {}
    for account in DEMO_ACCOUNTS:
        existing = session.query(User).filter_by(email=account["email"]).first()
        if existing:
            email_to_id[account["email"]] = existing.id
            continue
        user = User(
            email=account["email"],
            password_hash=pwd_context.hash(account["password"]),
            role=account["role"],
        )
        session.add(user)
        session.flush()
        email_to_id[account["email"]] = user.id
    return email_to_id


def _seed_businesses(session, data: list[dict]) -> list[int]:
    """Insert businesses from JSON data. Returns list of business ids."""
    ids: list[int] = []
    for item in data:
        existing = (
            session.query(Business)
            .filter_by(name=item["name"], city=item["city"])
            .first()
        )
        if existing:
            ids.append(existing.id)
            continue
        biz = Business(
            name=item["name"],
            category=item["category"],
            address=item.get("address"),
            city=item["city"],
            zip=item.get("zip"),
            lat=item.get("lat"),
            lng=item.get("lng"),
            phone=item.get("phone"),
            website=item.get("website"),
            description=item.get("description"),
            hours=item.get("hours"),
            is_chain=item.get("is_chain", False),
        )
        session.add(biz)
        session.flush()
        ids.append(biz.id)
    return ids


def _seed_reviews(session, biz_ids: list[int], user_id: int) -> None:
    """Add sample reviews to some businesses for demo purposes."""
    sample_reviews = [
        (5, "Absolutely amazing experience! Will definitely come back."),
        (4, "Great quality and friendly staff. Highly recommend."),
        (5, "Best in the area. Outstanding service every time."),
        (3, "Decent place, but could improve on wait times."),
        (4, "Love the atmosphere and the attention to detail."),
        (5, "A hidden gem! So glad I discovered this place."),
        (4, "Solid experience overall. Good value for the price."),
        (3, "Nice enough, but nothing particularly special."),
        (5, "Exceeded all my expectations. Truly world-class."),
        (4, "Consistently good quality. A reliable go-to spot."),
    ]
    for i, biz_id in enumerate(biz_ids[:len(sample_reviews)]):
        existing = (
            session.query(Review)
            .filter_by(business_id=biz_id, user_id=user_id)
            .first()
        )
        if existing:
            continue
        rating, text = sample_reviews[i]
        review = Review(
            business_id=biz_id,
            user_id=user_id,
            rating=rating,
            text=text,
        )
        session.add(review)
    session.flush()
    _recompute_ratings(session, biz_ids[:len(sample_reviews)])


def _recompute_ratings(session, biz_ids: list[int]) -> None:
    """Recompute avg_rating and review_count for given businesses."""
    from sqlalchemy import func

    for biz_id in biz_ids:
        result = (
            session.query(
                func.avg(Review.rating),
                func.count(Review.id),
            )
            .filter(Review.business_id == biz_id)
            .first()
        )
        avg_val = float(result[0]) if result[0] else 0.0
        count_val = int(result[1]) if result[1] else 0
        session.query(Business).filter_by(id=biz_id).update(
            {"avg_rating": round(avg_val, 2), "review_count": count_val}
        )


def _seed_deals(session, biz_ids: list[int]) -> None:
    """Create sample deals on a few businesses."""
    sample_deals = [
        ("20% Off First Visit", "New customers get 20% off their first order."),
        ("Happy Hour Special", "Half-price appetizers Mon-Fri 3-5 PM."),
        ("Buy One Get One Free", "BOGO on select menu items every Tuesday."),
        ("Free Consultation", "Complimentary 30-minute consultation for new clients."),
        ("Weekend Bundle Deal", "Special weekend package at a discounted rate."),
    ]
    future_date = datetime.now(timezone.utc).date() + timedelta(days=90)
    for i, (title, desc) in enumerate(sample_deals):
        biz_id = biz_ids[i * 2] if i * 2 < len(biz_ids) else biz_ids[i]
        existing = (
            session.query(Deal).filter_by(business_id=biz_id, title=title).first()
        )
        if existing:
            continue
        deal = Deal(
            business_id=biz_id,
            title=title,
            description=desc,
            expiry_date=future_date,
            is_active=True,
        )
        session.add(deal)


def _claim_business_for_owner(session, biz_id: int, owner_id: int) -> None:
    """Pre-claim a business for the demo business owner account."""
    existing = (
        session.query(BusinessClaim)
        .filter_by(business_id=biz_id, user_id=owner_id)
        .first()
    )
    if existing:
        return
    claim = BusinessClaim(
        business_id=biz_id,
        user_id=owner_id,
        status="approved",
        reviewed_at=datetime.now(timezone.utc),
    )
    session.add(claim)
    session.query(Business).filter_by(id=biz_id).update(
        {"claimed": True, "owner_id": owner_id}
    )


def main() -> None:
    """Run the full seed pipeline."""
    print("Creating tables...")
    _create_tables()

    print(f"Loading businesses from {DATA_FILE}...")
    data = _load_businesses_json()
    print(f"Found {len(data)} businesses in seed file.")

    session = SessionLocal()
    try:
        print("Seeding demo user accounts...")
        email_to_id = _seed_users(session)

        print("Seeding businesses...")
        biz_ids = _seed_businesses(session, data)

        print("Seeding sample reviews...")
        demo_user_id = email_to_id["demo@example.com"]
        _seed_reviews(session, biz_ids, demo_user_id)

        print("Seeding sample deals...")
        _seed_deals(session, biz_ids)

        print("Claiming a business for the owner account...")
        owner_id = email_to_id["owner@example.com"]
        _claim_business_for_owner(session, biz_ids[0], owner_id)

        session.commit()
        print(f"Seed complete: {len(biz_ids)} businesses, 3 users, sample reviews & deals.")
    except Exception as e:
        session.rollback()
        print(f"Error during seeding: {e}", file=sys.stderr)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
