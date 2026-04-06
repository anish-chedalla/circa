"""SQLAlchemy model for the businesses table."""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class Business(Base):
    """
    Core business entity for discovery, ownership, and analytics workflows.

    Field groups in this model intentionally cover multiple concerns:
    - identity/location fields for map + search UX
    - Google enrichment cache fields for external data integration
    - reputation/engagement fields for ranking and recommendation logic
    - ownership/listing lifecycle fields for admin and owner workflows
    """

    __tablename__ = "businesses"

    # ------------------------------------------------------------------
    # Identity + taxonomy
    # ------------------------------------------------------------------
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)

    # ------------------------------------------------------------------
    # Physical location / contact
    # ------------------------------------------------------------------
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str | None] = mapped_column(String(10), nullable=True)
    zip: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Google enrichment cache (persisted so frontend never needs direct API key)
    # ------------------------------------------------------------------
    google_place_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    google_photo_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    google_photo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    google_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    google_last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # JSON supports variable key sets like {"Monday": "9 AM - 5 PM"}.
    hours: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # ------------------------------------------------------------------
    # Quality / ranking signals
    # ------------------------------------------------------------------
    is_chain: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avg_rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # ------------------------------------------------------------------
    # Ownership + moderation lifecycle
    # ------------------------------------------------------------------
    listing_status: Mapped[str] = mapped_column(String(20), default="approved", nullable=False)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    owner_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # ------------------------------------------------------------------
    # Timestamps
    # ------------------------------------------------------------------
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ------------------------------------------------------------------
    # Relationships (lazy select keeps object graph loading explicit in routes)
    # ------------------------------------------------------------------
    owner = relationship("User", back_populates="owned_businesses", lazy="select")
    reviews = relationship("Review", back_populates="business", lazy="select")
    deals = relationship("Deal", back_populates="business", lazy="select")
    favorites = relationship("Favorite", back_populates="business", lazy="select")
    claims = relationship("BusinessClaim", back_populates="business", lazy="select")
    events = relationship("BusinessEvent", back_populates="business", lazy="select")

    def __repr__(self) -> str:
        """
        Compact debug representation.

        Useful in logs/trace output when quickly identifying rows without
        serializing the full ORM object.
        """
        return f"<Business id={self.id} name={self.name!r}>"
