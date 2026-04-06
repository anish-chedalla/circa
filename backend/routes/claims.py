"""
Business-claim router.

This module demonstrates a layered endpoint pattern:
1. Search endpoint (read-only discovery of claimable businesses).
2. Submit endpoint (validated write path with role checks + file upload).
3. Small serializer helper to keep response shape stable.
"""

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.business import Business
from backend.models.business_claim import BusinessClaim
from backend.utils.auth import get_current_user
from backend.utils.auth import require_role

router = APIRouter(prefix="/api/claims", tags=["claims"])
_owner_only = Depends(require_role("business_owner"))
# Claim evidence storage is colocated under uploads so admins can review files
# through static URLs without introducing a separate file service.
_CLAIM_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "claim-documents"
_CLAIM_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
_ALLOWED_DOC_TYPES = {"application/pdf"}
_MAX_DOC_BYTES = 10 * 1024 * 1024
_MAX_DOC_COUNT = 5


def _serialize_claim(claim: BusinessClaim, business: Business | None = None) -> dict:
    """
    Convert a claim ORM object to a client-safe response shape.

    Keeping serialization logic in one place makes admin and owner views
    consistent and reduces duplicated field-mapping bugs.
    """
    result = {
        "id": claim.id,
        "business_id": claim.business_id,
        "user_id": claim.user_id,
        "status": claim.status,
        "submitted_at": claim.submitted_at.isoformat() if claim.submitted_at else None,
    }
    if business:
        result["business_name"] = business.name
        result["business_city"] = business.city
    result["claim_message"] = claim.claim_message
    result["proof_document_urls"] = claim.proof_document_urls or []
    return result


@router.get("/search")
def search_unclaimed(
    name: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _=_owner_only,
):
    """
    Return up to 10 unclaimed businesses matching the provided name fragment.

    This endpoint is intentionally scoped to owner accounts only to prevent
    regular users from initiating ownership workflows.
    """
    results = (
        db.query(Business)
        .filter(
            Business.claimed == False,  # noqa: E712
            func.lower(Business.name).contains(name.lower()),
        )
        .limit(10)
        .all()
    )
    return {
        "data": [
            {
                "id": b.id, "name": b.name, "category": b.category,
                "city": b.city, "address": b.address,
            }
            for b in results
        ],
        "error": None,
    }


@router.post("")
def submit_claim(
    request: Request,
    business_id: int = Form(...),
    claim_message: str | None = Form(None),
    proof_documents: list[UploadFile] | None = File(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=_owner_only,
):
    """
    Submit an ownership claim with optional message and PDF proof documents.

    Validation order is intentionally defensive:
    1. Business existence / current claim state
    2. Duplicate pending-claim check for same user + business
    3. Message/document constraints
    4. File persistence
    5. Claim row creation
    """
    # Basic ownership preconditions.
    biz = db.query(Business).filter_by(id=business_id).first()
    if not biz:
        return JSONResponse(status_code=404, content={"data": None, "error": "Business not found"})
    if biz.claimed:
        return JSONResponse(status_code=409, content={"data": None, "error": "This business has already been claimed"})

    # Enforce at most one pending claim per (user, business) to keep review
    # queue clean and avoid duplicate admin actions.
    existing = (
        db.query(BusinessClaim)
        .filter_by(business_id=business_id, user_id=current_user.id, status="pending")
        .first()
    )
    if existing:
        return JSONResponse(status_code=409, content={"data": None, "error": "You already have a pending claim for this business"})

    # Message is optional but bounded to keep storage/admin UX manageable.
    trimmed_message = (claim_message or "").strip()
    if len(trimmed_message) > 2000:
        return JSONResponse(status_code=400, content={"data": None, "error": "Claim message must be 2000 characters or fewer"})

    # PDF proof docs are optional but constrained in count/size/type.
    uploads = proof_documents or []
    if len(uploads) > _MAX_DOC_COUNT:
        return JSONResponse(status_code=400, content={"data": None, "error": f"You can upload up to {_MAX_DOC_COUNT} PDF documents"})

    proof_urls: list[str] = []
    for doc in uploads:
        content_type = (doc.content_type or "").lower()
        if content_type not in _ALLOWED_DOC_TYPES:
            return JSONResponse(status_code=400, content={"data": None, "error": "Only PDF files are allowed for claim documents"})
        content = doc.file.read()
        if not content:
            return JSONResponse(status_code=400, content={"data": None, "error": f"Document '{doc.filename or 'file'}' is empty"})
        if len(content) > _MAX_DOC_BYTES:
            return JSONResponse(status_code=400, content={"data": None, "error": f"Document '{doc.filename or 'file'}' exceeds 10 MB"})

        # Use deterministic metadata plus UUID to prevent collisions.
        filename = f"{current_user.id}-{business_id}-{uuid4().hex}.pdf"
        save_path = _CLAIM_UPLOAD_DIR / filename
        with open(save_path, "wb") as out:
            out.write(content)
        proof_urls.append(str(request.url_for("uploads", path=f"claim-documents/{filename}")))

    # Persist claim with metadata needed for admin review decisions.
    claim = BusinessClaim(
        business_id=business_id,
        user_id=current_user.id,
        status="pending",
        claim_message=trimmed_message or None,
        proof_document_urls=proof_urls or None,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return {"data": _serialize_claim(claim, biz), "error": None}
