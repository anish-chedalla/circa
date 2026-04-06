"""Seed/update businesses with real Google Places data.

Usage examples:
    python -m backend.scripts.seed_real_businesses_from_google --cities Phoenix Scottsdale Tempe
    python -m backend.scripts.seed_real_businesses_from_google --cities Phoenix --per-query-limit 40 --hide-unmatched
"""

from __future__ import annotations

import argparse
import time
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models.business import Business
from backend.services.google_places_enrichment import (
    CATEGORY_QUERY_MAP,
    apply_google_details_to_business,
    fetch_place_details,
    get_google_api_key,
    text_search_places,
)


@dataclass
class SyncStats:
    created: int = 0
    updated: int = 0
    hidden: int = 0
    searched: int = 0
    detail_calls: int = 0
    errors: int = 0


def _build_cli() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Seed/update businesses from Google Places text search results."
    )
    parser.add_argument(
        "--cities",
        nargs="+",
        required=True,
        help="One or more Arizona cities to seed (e.g. Phoenix Scottsdale Tempe).",
    )
    parser.add_argument(
        "--per-query-limit",
        type=int,
        default=30,
        help="Max places to process for each category/city query.",
    )
    parser.add_argument(
        "--hide-unmatched",
        action="store_true",
        help="Hide existing non-owner approved rows not refreshed by Google sync.",
    )
    parser.add_argument(
        "--sleep-seconds",
        type=float,
        default=2.2,
        help="Delay between paginated text search requests (Google requires token maturation).",
    )
    return parser


def _iter_text_search_place_ids(
    api_key: str,
    query: str,
    *,
    limit: int,
    sleep_seconds: float,
) -> list[str]:
    place_ids: list[str] = []
    next_page_token: str | None = None

    while len(place_ids) < limit:
        payload = text_search_places(query=query, api_key=api_key, pagetoken=next_page_token)
        results = payload.get("results", [])
        for item in results:
            place_id = item.get("place_id")
            if isinstance(place_id, str) and place_id and place_id not in place_ids:
                place_ids.append(place_id)
                if len(place_ids) >= limit:
                    break

        next_page_token = payload.get("next_page_token")
        if not next_page_token or len(place_ids) >= limit:
            break
        time.sleep(max(sleep_seconds, 0.0))

    return place_ids


def _find_existing_business(db: Session, place_id: str, details: dict) -> Business | None:
    existing = db.query(Business).filter(Business.google_place_id == place_id).first()
    if existing:
        return existing

    name = details.get("name")
    if not isinstance(name, str) or not name.strip():
        return None
    city = None
    components = details.get("address_components", [])
    for component in components:
        types = component.get("types", [])
        if "locality" in types:
            city = component.get("long_name")
            break
    if not isinstance(city, str) or not city.strip():
        return None

    return (
        db.query(Business)
        .filter(Business.name.ilike(name.strip()), Business.city.ilike(city.strip()))
        .first()
    )


def _create_business_shell(category: str) -> Business:
    return Business(
        name="Pending Name",
        category=category,
        city="Phoenix",
        listing_status="approved",
        claimed=False,
        is_chain=False,
        avg_rating=0.0,
        review_count=0,
    )


def _seed_city(
    db: Session,
    api_key: str,
    city: str,
    per_query_limit: int,
    sleep_seconds: float,
    refreshed_ids: set[int],
    stats: SyncStats,
) -> None:
    city_clean = city.strip()
    for category, template in CATEGORY_QUERY_MAP.items():
        query = template.format(city=city_clean)
        print(f"[google-seed] Searching {category} in {city_clean}: {query}")
        stats.searched += 1

        try:
            place_ids = _iter_text_search_place_ids(
                api_key=api_key,
                query=query,
                limit=per_query_limit,
                sleep_seconds=sleep_seconds,
            )
        except Exception as exc:
            stats.errors += 1
            print(f"[google-seed] Search failed for query '{query}': {exc}")
            continue

        for place_id in place_ids:
            try:
                details = fetch_place_details(place_id, api_key)
                stats.detail_calls += 1
                existing = _find_existing_business(db, place_id, details)

                if existing is None:
                    business = _create_business_shell(category=category)
                    apply_google_details_to_business(business, details, api_key)
                    # Keep mapped category when Google types are ambiguous.
                    if not business.category:
                        business.category = category
                    business.google_last_synced_at = datetime.now(timezone.utc)
                    db.add(business)
                    db.flush()
                    refreshed_ids.add(business.id)
                    stats.created += 1
                else:
                    apply_google_details_to_business(existing, details, api_key)
                    existing.google_last_synced_at = datetime.now(timezone.utc)
                    # Keep owner-submitted listings approved and intact on ownership flags.
                    existing.listing_status = existing.listing_status or "approved"
                    db.add(existing)
                    db.flush()
                    refreshed_ids.add(existing.id)
                    stats.updated += 1
            except Exception as exc:
                stats.errors += 1
                print(f"[google-seed] Failed to process place_id={place_id}: {exc}")

        db.commit()


def _hide_unmatched_non_owner_rows(
    db: Session, refreshed_ids: set[int], stats: SyncStats
) -> None:
    if not refreshed_ids:
        return
    rows = (
        db.query(Business)
        .filter(Business.listing_status == "approved")
        .filter(Business.owner_id.is_(None))
        .filter(~Business.id.in_(list(refreshed_ids)))
        .all()
    )
    for row in rows:
        row.listing_status = "rejected"
        row.rejection_reason = "Auto-hidden: replaced by Google Places real-data sync."
        stats.hidden += 1
    db.commit()


def run(cities: Iterable[str], per_query_limit: int, hide_unmatched: bool, sleep_seconds: float) -> SyncStats:
    api_key = get_google_api_key()
    db = SessionLocal()
    stats = SyncStats()
    refreshed_ids: set[int] = set()

    try:
        for city in cities:
            _seed_city(
                db=db,
                api_key=api_key,
                city=city,
                per_query_limit=per_query_limit,
                sleep_seconds=sleep_seconds,
                refreshed_ids=refreshed_ids,
                stats=stats,
            )
        if hide_unmatched:
            _hide_unmatched_non_owner_rows(db, refreshed_ids, stats)
        return stats
    finally:
        db.close()


def main() -> None:
    args = _build_cli().parse_args()
    stats = run(
        cities=args.cities,
        per_query_limit=args.per_query_limit,
        hide_unmatched=args.hide_unmatched,
        sleep_seconds=args.sleep_seconds,
    )
    print(
        "[google-seed] complete "
        f"created={stats.created} updated={stats.updated} hidden={stats.hidden} "
        f"searched={stats.searched} detail_calls={stats.detail_calls} errors={stats.errors}"
    )


if __name__ == "__main__":
    main()
