"""SQLAlchemy model for the users table."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class User(Base):
    """Represents an application user (consumer, business owner, or admin)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="user", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # -- relationships --
    reviews = relationship("Review", back_populates="user", lazy="select")
    favorites = relationship("Favorite", back_populates="user", lazy="select")
    business_claims = relationship(
        "BusinessClaim",
        back_populates="user",
        foreign_keys="BusinessClaim.user_id",
        lazy="select",
    )
    owned_businesses = relationship("Business", back_populates="owner", lazy="select")

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return f"<User id={self.id} email={self.email!r}>"
