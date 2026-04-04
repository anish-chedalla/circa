"""FastAPI router for platform analytics data (public endpoint)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.analytics_report import get_analytics

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
def analytics(db: Session = Depends(get_db)):
    """
    Return platform-wide analytics for the dashboard.

    Includes top-rated businesses, most-reviewed businesses,
    category breakdown, active deals count, and totals.
    """
    data = get_analytics(db)
    return {"data": data, "error": None}
