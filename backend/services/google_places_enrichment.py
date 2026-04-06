"""Google Places enrichment and import helpers for business records."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus

import httpx
from sqlalchemy.orm import Session

from backend.models.business import Business

GOOGLE_PLACES_API_KEY_ENVS = ("GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY")
GOOGLE_FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
GOOGLE_TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
GOOGLE_PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GOOGLE_PHOTO_URL = "https://maps.googleapis.com/maps/api/place/photo"


CATEGORY_QUERY_MAP: dict[str, str] = {
    "Restaurants": "independent restaurants in {city}, Arizona",
    "Coffee Shops": "coffee shops in {city}, Arizona",
    "Retail/Shopping": "local retail stores in {city}, Arizona",
    "Health & Wellness": "health and wellness businesses in {city}, Arizona",
    "Arts & Entertainment": "arts and entertainment venues in {city}, Arizona",
    "Professional Services": "professional services in {city}, Arizona",
    "Home Services": "home services in {city}, Arizona",
    "Fitness & Recreation": "fitness and recreation businesses in {city}, Arizona",
}


def enrich_business_by_id(db: Session, business_id: int) -> dict[str, Any]:
    """Enrich one business by id and persist Google metadata + key place details."""
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
            results.append(
                {"id": business.id, "name": business.name, "status": "ok", "data": enriched}
            )
        except Exception as exc:  # keep batch progress even if one fails
            results.append(
                {"id": business.id, "name": business.name, "status": "error", "error": str(exc)}
            )
    return results


def enrich_business(db: Session, business: Business) -> dict[str, Any]:
    """
    Fetch Google place details for a business and persist fields.

    Besides Google metadata fields, this also updates core listing fields
    (address, coordinates, phone, website, hours, avg_rating, review_count)
    when returned by Google.
    """
    api_key = get_google_api_key()
    query = _build_query(business)
    place = _find_place(query, api_key)
    if not place:
        raise RuntimeError(f"No Google place match found for: {query}")

    place_id = place.get("place_id")
    if not place_id:
        raise RuntimeError("Google response missing place_id")

    details = _fetch_place_details(place_id, api_key)
    _apply_google_details_to_business(business, details, api_key)
    business.google_last_synced_at = datetime.now(timezone.utc)

    db.add(business)
    db.commit()
    db.refresh(business)
    return _serialize_enrichment(business)


def get_google_api_key() -> str:
    """Read Google API key from supported env vars."""
    for env_name in GOOGLE_PLACES_API_KEY_ENVS:
        value = os.getenv(env_name, "").strip()
        if value:
            return value
    names = ", ".join(GOOGLE_PLACES_API_KEY_ENVS)
    raise RuntimeError(f"Google API key not configured. Set one of: {names}")


def text_search_places(
    query: str,
    api_key: str,
    *,
    pagetoken: str | None = None,
    timeout: float = 15.0,
) -> dict[str, Any]:
    """Call Places Text Search (Legacy) and return parsed JSON."""
    params: dict[str, Any] = {"query": query, "key": api_key}
    if pagetoken:
        params["pagetoken"] = pagetoken
    with httpx.Client(timeout=timeout) as client:
        response = client.get(GOOGLE_TEXT_SEARCH_URL, params=params)
        response.raise_for_status()
        payload = response.json()
    status = payload.get("status")
    if status not in {"OK", "ZERO_RESULTS"}:
        error_message = payload.get("error_message", status)
        raise RuntimeError(f"Google text search failed: {error_message}")
    return payload


def fetch_place_details(place_id: str, api_key: str) -> dict[str, Any]:
    """Public helper to fetch detailed Google place payload by place_id."""
    return _fetch_place_details(place_id, api_key)


def apply_google_details_to_business(
    business: Business, details: dict[str, Any], api_key: str
) -> None:
    """Public helper to update a Business ORM instance from Google details."""
    _apply_google_details_to_business(business, details, api_key)


def _build_query(business: Business) -> str:
    parts = [business.name]
    if business.address:
        parts.append(business.address)
    if business.city:
        parts.append(business.city)
    if business.state:
        parts.append(business.state)
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
    status = data.get("status")
    if status not in {"OK", "ZERO_RESULTS"}:
        error_message = data.get("error_message", status)
        raise RuntimeError(f"Google find place failed: {error_message}")
    candidates = data.get("candidates", [])
    return candidates[0] if candidates else None


def _fetch_place_details(place_id: str, api_key: str) -> dict[str, Any]:
    params = {
        "place_id": place_id,
        "fields": ",".join(
            [
                "place_id",
                "name",
                "types",
                "formatted_address",
                "address_component",
                "geometry",
                "website",
                "url",
                "formatted_phone_number",
                "editorial_summary",
                "photos",
                "opening_hours",
                "rating",
                "user_ratings_total",
            ]
        ),
        "key": api_key,
    }
    with httpx.Client(timeout=12.0) as client:
        response = client.get(GOOGLE_PLACE_DETAILS_URL, params=params)
        response.raise_for_status()
        data = response.json()
    status = data.get("status")
    if status != "OK":
        error_message = data.get("error_message", status)
        raise RuntimeError(f"Google place details failed: {error_message}")
    return data.get("result", {})


def _apply_google_details_to_business(
    business: Business, details: dict[str, Any], api_key: str
) -> None:
    place_id = details.get("place_id")
    if place_id:
        business.google_place_id = place_id

    name = details.get("name")
    if isinstance(name, str) and name.strip():
        business.name = name.strip()

    formatted_address = details.get("formatted_address")
    if isinstance(formatted_address, str) and formatted_address.strip():
        business.address = formatted_address.strip()

    _apply_address_components(business, details.get("address_components", []))

    location = (details.get("geometry") or {}).get("location") or {}
    lat = location.get("lat")
    lng = location.get("lng")
    if isinstance(lat, (int, float)):
        business.lat = float(lat)
    if isinstance(lng, (int, float)):
        business.lng = float(lng)

    phone = details.get("formatted_phone_number")
    if isinstance(phone, str) and phone.strip():
        business.phone = phone.strip()

    website = details.get("website")
    if isinstance(website, str) and website.strip():
        business.website = website.strip()

    summary = _extract_summary(details)
    if summary:
        business.google_summary = summary
        if not business.description or not business.description.strip():
            business.description = summary

    photo_ref = _extract_photo_ref(details)
    photo_url = _build_photo_url(photo_ref, api_key) if photo_ref else None
    business.google_photo_ref = photo_ref
    business.google_photo_url = photo_url

    opening_hours = details.get("opening_hours")
    if isinstance(opening_hours, dict):
        weekdays = opening_hours.get("weekday_text")
        if isinstance(weekdays, list) and weekdays:
            normalized: dict[str, str] = {}
            for line in weekdays:
                if not isinstance(line, str) or ":" not in line:
                    continue
                day, value = line.split(":", 1)
                normalized[day.strip()] = value.strip()
            if normalized:
                business.hours = normalized

    rating = details.get("rating")
    if isinstance(rating, (int, float)):
        business.avg_rating = round(float(rating), 2)

    ratings_total = details.get("user_ratings_total")
    if isinstance(ratings_total, int):
        business.review_count = ratings_total

    category = _map_google_types_to_category(details.get("types", []))
    if category:
        business.category = category


def _apply_address_components(business: Business, components: list[dict[str, Any]]) -> None:
    city = None
    state = None
    postal_code = None
    for component in components:
        types = component.get("types", [])
        short_name = component.get("short_name")
        long_name = component.get("long_name")
        if "locality" in types and isinstance(long_name, str):
            city = long_name
        elif "administrative_area_level_1" in types and isinstance(short_name, str):
            state = short_name
        elif "postal_code" in types and isinstance(long_name, str):
            postal_code = long_name

    if city:
        business.city = city
    if state:
        business.state = state
    if postal_code:
        business.zip = postal_code


def _map_google_types_to_category(types: list[Any]) -> str | None:
    lower_types = {str(t).lower() for t in types}
    if {"restaurant", "meal_takeaway", "meal_delivery"} & lower_types:
        return "Restaurants"
    if {"cafe", "coffee_shop"} & lower_types:
        return "Coffee Shops"
    if {"store", "shopping_mall", "clothing_store", "book_store"} & lower_types:
        return "Retail/Shopping"
    if {"spa", "beauty_salon", "hair_care", "health"} & lower_types:
        return "Health & Wellness"
    if {"movie_theater", "museum", "art_gallery", "night_club"} & lower_types:
        return "Arts & Entertainment"
    if {"lawyer", "accounting", "insurance_agency", "real_estate_agency"} & lower_types:
        return "Professional Services"
    if {"electrician", "plumber", "roofing_contractor", "home_goods_store"} & lower_types:
        return "Home Services"
    if {"gym", "park", "stadium", "tourist_attraction"} & lower_types:
        return "Fitness & Recreation"
    return None


def _extract_photo_ref(details: dict[str, Any]) -> str | None:
    photos = details.get("photos", [])
    if photos and photos[0].get("photo_reference"):
        return photos[0]["photo_reference"]
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
            business.google_last_synced_at.isoformat() if business.google_last_synced_at else None
        ),
        "name": business.name,
        "category": business.category,
        "address": business.address,
        "city": business.city,
        "state": business.state,
        "zip": business.zip,
        "lat": business.lat,
        "lng": business.lng,
        "phone": business.phone,
        "website": business.website,
        "avg_rating": business.avg_rating,
        "review_count": business.review_count,
    }
