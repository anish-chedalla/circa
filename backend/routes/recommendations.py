"""FastAPI router for personalized business recommendations."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.recommendation_engine import get_recommendations
from backend.utils.auth import get_current_user

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.get("/recommendations")
def recommendations(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Return personalized business recommendations for the authenticated user.

    Uses the content-based algorithm if the user has 2+ favorites;
    falls back to Hidden Gems with meta.fallback=true otherwise.
    """
    results, fallback = get_recommendations(db, current_user.id, limit=limit)
    return {
        "data": results,
        "meta": {"fallback": fallback},
        "error": None,
    }
