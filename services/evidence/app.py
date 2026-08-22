"""Evidence Service — deterministic evidence extraction microservice.

Reduces Gemini usage by performing discovery, retrieval, sanitization,
identity verification, and deterministic extraction before any Gemini call.

Run: uvicorn app:app --host 0.0.0.0 --port 8000
"""

import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import FastAPI
from pydantic import BaseModel, Field

from search import discover_sources, get_provider
from fetch import retrieve_url
from sanitize import sanitize_html, extract_product_text
from identity import verify_identity, normalize_mpn
from extract import (
    extract_deterministic_fields,
    determine_gemini_needs,
)
from security import validate_url

app = FastAPI(title="Evidence Service", version="1.0.0")

MAX_EVIDENCE_SNIPPET = 300


class EvidenceCheckRequest(BaseModel):
    manufacturer: str = ""
    brand: str = ""
    mpn: str = ""
    description: str = ""
    category: str = ""
    missing_fields: List[str] = Field(default_factory=list)


class SourceInfo(BaseModel):
    url: str
    title: str
    domain: str
    source_type: str
    authority_tier: int
    retrieved_at: str


class EvidenceItem(BaseModel):
    field: str
    value: Any
    uom: str = ""
    evidence: str
    source_url: str
    confidence: float


class EvidenceCheckResponse(BaseModel):
    success: bool
    needs_search: bool
    source: Optional[SourceInfo]
    identity_match: bool
    identity_confidence: float
    reject_reason: Optional[str]
    evidence: List[EvidenceItem]
    deterministic_fields: Dict[str, Any]
    needs_gemini: List[str]
    unresolved: List[str]


def classify_source(url: str) -> tuple:
    """Classify a URL into (source_type, authority_tier)."""
    host = (urlparse(url).hostname or "").lower()
    # Heuristic: vendor-looking TLDs / known distributor patterns.
    distributor_markers = ("distributor", "supply", "grainger", "mcmaster",
                           "zoro", "fry", "newark", "digikey", "mouser")
    if any(m in host for m in distributor_markers):
        return "distributor", 3
    return "manufacturer", 1  # default: treat direct hits as manufacturer tier-1


@app.get("/")
async def root():
    provider = type(get_provider()).__name__
    return {"service": "evidence", "version": "1.0.0", "search_provider": provider}


@app.post("/evidence/check", response_model=EvidenceCheckResponse)
async def evidence_check(request: EvidenceCheckRequest):
    """Full pipeline: discovery -> retrieval -> sanitize -> verify -> extract."""
    missing = request.missing_fields or []

    # --- 1. Source discovery (skips entirely when identity is too weak) ---
    candidates, needs_search = discover_sources(
        request.manufacturer, request.brand, request.mpn, request.description
    )
    if not candidates:
        needs_gemini, unresolved = determine_gemini_needs(
            missing, {}, evidence_available=False
        )
        return EvidenceCheckResponse(
            success=True, needs_search=needs_search, source=None,
            identity_match=False, identity_confidence=0.0,
            reject_reason=None if not needs_search else "no sources found",
            evidence=[], deterministic_fields={},
            needs_gemini=[], unresolved=missing,
        )

    # --- 2/3/4. Retrieve, sanitize, verify, extract per candidate ---
    for candidate in candidates[:3]:  # bounded: max 3 retrievals per product
        url = candidate.get("url") or ""
        ok, _reason = validate_url(url)
        if not ok:
            continue

        retrieved = retrieve_url(url)
        if not retrieved:
            continue

        raw_text = sanitize_html(retrieved["content"])
        product_text = extract_product_text(raw_text)

        identity = verify_identity(
            request.manufacturer, request.mpn, request.brand, product_text
        )

        src_type, tier = classify_source(retrieved["final_url"])
        source_info = SourceInfo(
            url=retrieved["final_url"],
            title=(candidate.get("title") or "")[:200],
            domain=urlparse(retrieved["final_url"]).hostname or "",
            source_type=src_type,
            authority_tier=tier,
            retrieved_at=datetime.now(timezone.utc).isoformat(),
        )

        if not identity["identity_match"]:
            return EvidenceCheckResponse(
                success=True, needs_search=True, source=source_info,
                identity_match=False, identity_confidence=identity["confidence"],
                reject_reason=identity["reject_reason"],
                evidence=[], deterministic_fields={},
                needs_gemini=[], unresolved=missing,
            )

        fields = extract_deterministic_fields(
            product_text, source_url=retrieved["final_url"]
        )

        evidence_items = []
        deterministic_out: Dict[str, Any] = {}
        for field_name, data in fields.items():
            value = data["value"]
            uom = data["uom"]
            try:
                from normalize import normalize_field
                value, uom = normalize_field(field_name, value, uom)
            except Exception:
                pass

            evidence_items.append(EvidenceItem(
                field=field_name, value=value, uom=uom,
                evidence=data["evidence"][:MAX_EVIDENCE_SNIPPET],
                source_url=data["source_url"], confidence=data["confidence"],
            ))
            deterministic_out[field_name] = {
                "value": value, "uom": uom,
                "evidence": data["evidence"][:MAX_EVIDENCE_SNIPPET],
                "source_url": data["source_url"],
                "confidence": data["confidence"],
            }

        needs_gemini, unresolved = determine_gemini_needs(
            missing, fields, evidence_available=bool(product_text)
        )

        return EvidenceCheckResponse(
            success=True, needs_search=True, source=source_info,
            identity_match=True, identity_confidence=identity["confidence"],
            reject_reason=None, evidence=evidence_items,
            deterministic_fields=deterministic_out,
            needs_gemini=needs_gemini, unresolved=unresolved,
        )

    # All candidates failed retrieval/validation
    return EvidenceCheckResponse(
        success=True, needs_search=True, source=None,
        identity_match=False, identity_confidence=0.0,
        reject_reason="retrieval failed for all candidates",
        evidence=[], deterministic_fields={},
        needs_gemini=[], unresolved=missing,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("EVIDENCE_PORT", "8000")))
