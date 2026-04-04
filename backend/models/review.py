"""SQLAlchemy model for the reviews table."""

from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Review(Base):
    """Represents a user review for a business (one review per user per business)."""

    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("business_id", "user_id", name="uq_review_business_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("businesses.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # -- relationships --
    user = relationship("User", back_populates="reviews", lazy="select")
    business = relationship("Business", back_populates="reviews", lazy="select")

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return f"<Review id={self.id} rating={self.rating}>"
