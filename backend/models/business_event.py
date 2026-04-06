"""SQLAlchemy model for tracking business engagement events."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class BusinessEvent(Base):
    """Represents a tracked interaction event for a business listing."""

    __tablename__ = "business_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("businesses.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    business = relationship("Business", back_populates="events", lazy="select")

    def __repr__(self) -> str:
        """Return a concise debug representation."""
        return f"<BusinessEvent id={self.id} business_id={self.business_id} type={self.event_type}>"
