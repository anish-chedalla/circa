"""SQLAlchemy model for the business_claims table."""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class BusinessClaim(Base):
    """Represents a request by a user to claim ownership of a business listing."""

    __tablename__ = "business_claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    business_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("businesses.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False
    )
    claim_message: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    proof_document_urls: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # -- relationships --
    user = relationship(
        "User", back_populates="business_claims", foreign_keys=[user_id], lazy="select"
    )
    business = relationship("Business", back_populates="claims", lazy="select")
    reviewer = relationship("User", foreign_keys=[reviewer_id], lazy="select")

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return f"<BusinessClaim id={self.id} status={self.status!r}>"
