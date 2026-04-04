"""SQLAlchemy model for the favorites table."""

from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Favorite(Base):
    """Represents a user's favorited business (one favorite per user per business)."""

    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "business_id", name="uq_favorite_user_business"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    business_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("businesses.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # -- relationships --
    user = relationship("User", back_populates="favorites", lazy="select")
    business = relationship("Business", back_populates="favorites", lazy="select")

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return f"<Favorite id={self.id} user={self.user_id} biz={self.business_id}>"
