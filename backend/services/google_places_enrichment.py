"""Google Places enrichment service for business records."""

import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus

import httpx
from sqlalchemy.orm import Session

from backend.models.business import Business

GOOGLE_PLACES_API_KEY_ENV = "GOOGLE_PLACES_API_KEY"
GOOGLE_FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
GOOGLE_PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GOOGLE_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"


def enrich_business_by_id(db: Session, business_id: int) -> dict[str, Any]:
    """Enrich one business by id and persist Google metadata."""
    business = db.query(Business).filter_by(id=business_id).first()
    if not business:
        raise ValueError("Business not found")
    return enrich_business(db, business)


def enrich_multiple_businesses(db: Session, limit: int = 20) -> list[dict[str, Any]]:
    """Enrich up to `limit` businesses and return per-row status summaries."""
    rows = (
        db.query(Business)
        .order_by(Business.google_last_synced_at.asc().nullsfirst(), Business.id.asc())
        .limit(limit)
        .all()
    )
    results: list[dict[str, Any]] = []
    for business in rows:
        try:
            enriched = enrich_business(db, business)
            results.append({"id": business.id, "name": business.name, "status": "ok", "data": enriched})
        except Exception as exc:  # keep batch progress even if one fails
            results.append({"id": business.id, "name": business.name, "status": "error", "error": str(exc)})
    return results


def enrich_business(db: Session, business: Business) -> dict[str, Any]:
    """Fetch Google place details for a business and persist fields."""
    api_key = _get_api_key()
    query = _build_query(business)
    place = _find_place(query, api_key)
    if not place:
        raise RuntimeError(f"No Google place match found for: {query}")

    place_id = place.get("place_id")
    if not place_id:
        raise RuntimeError("Google response missing place_id")

    details = _fetch_place_details(place_id, api_key)
    photo_ref = _extract_photo_ref(details, fallback=place)
    photo_url = _build_photo_url(photo_ref, api_key) if photo_ref else None
    summary = _extract_summary(details)

    business.google_place_id = place_id
    business.google_photo_ref = photo_ref
    business.google_photo_url = photo_url
    business.google_summary = summary
    business.google_last_synced_at = datetime.now(timezone.utc)
    db.add(business)
    db.commit()
    db.refresh(business)
    return _serialize_enrichment(business)


def _get_api_key() -> str:
    api_key = os.getenv(GOOGLE_PLACES_API_KEY_ENV, "").strip()
    if not api_key:
        raise RuntimeError(f"{GOOGLE_PLACES_API_KEY_ENV} is not configured")
    return api_key


def _build_query(business: Business) -> str:
    parts = [business.name]
    if business.address:
        parts.append(business.address)
    if business.city:
        parts.append(business.city)
    if business.zip:
        parts.append(business.zip)
    return ", ".join(parts)


def _find_place(query: str, api_key: str) -> dict[str, Any] | None:
    params = {
        "input": query,
        "inputtype": "textquery",
        "fields": "place_id,name,formatted_address,photos",
        "key": api_key,
    }
    with httpx.Client(timeout=12.0) as client:
        response = client.get(GOOGLE_FIND_PLACE_URL, params=params)
        response.raise_for_status()
        data = response.json()
    candidates = data.get("candidates", [])
    return candidates[0] if candidates else None


def _fetch_place_details(place_id: str, api_key: str) -> dict[str, Any]:
    params = {
        "place_id": place_id,
        "fields": "name,formatted_address,website,editorial_summary,photos",
        "key": api_key,
    }
    with httpx.Client(timeout=12.0) as client:
        response = client.get(GOOGLE_PLACE_DETAILS_URL, params=params)
        response.raise_for_status()
        data = response.json()
    return data.get("result", {})


def _extract_photo_ref(details: dict[str, Any], fallback: dict[str, Any] | None = None) -> str | None:
    photos = details.get("photos", [])
    if photos and photos[0].get("photo_reference"):
        return photos[0]["photo_reference"]
    if fallback:
        fallback_photos = fallback.get("photos", [])
        if fallback_photos and fallback_photos[0].get("photo_reference"):
            return fallback_photos[0]["photo_reference"]
    return None


def _extract_summary(details: dict[str, Any]) -> str | None:
    editorial = details.get("editorial_summary", {})
    summary = editorial.get("overview")
    if not summary:
        return None
    return str(summary).strip() or None


def _build_photo_url(photo_ref: str, api_key: str) -> str:
    return (
        f"{GOOGLE_PHOTO_URL}?maxwidth=1280"
        f"&photoreference={quote_plus(photo_ref)}&key={quote_plus(api_key)}"
    )


def _serialize_enrichment(business: Business) -> dict[str, Any]:
    return {
        "google_place_id": business.google_place_id,
        "google_photo_ref": business.google_photo_ref,
        "google_photo_url": business.google_photo_url,
        "google_summary": business.google_summary,
        "google_last_synced_at": (
            business.google_last_synced_at.isoformat()
            if business.google_last_synced_at
            else None
        ),
    }
