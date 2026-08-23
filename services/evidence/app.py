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


# --- Explicit source classification (Bug 2 hardening) ---
# Unknown domains are NEVER promoted to "manufacturer".
# Domain matching uses strict hostname boundaries:
#   www.knownmfg.com      -> matches knownmfg.com
#   notknownmfg.com       -> does NOT match knownmfg.com
KNOWN_MANUFACTURER_DOMAINS = {
    "milwaukeetool.com", "dewalt.com", "boschtools.com", "makitatools.com",
    "metabo.com", "hilti.com", "3m.com", "stanleyblackanddecker.com",
}
KNOWN_DISTRIBUTOR_DOMAINS = {
    "grainger.com", "mcmaster.com", "zoro.com", "digikey.com",
    "mouser.com", "newark.com", "frys.com",
}
KNOWN_SECONDARY_DOMAINS = {
    # credible secondary/reference sources (standards bodies, references)
    "wikipedia.org", "ansi.org", "iso.org", "astm.org", "ul.com", "osha.gov",
}

AUTHORITY_TIERS = {
    "manufacturer": 1,
    "distributor": 2,
    "secondary": 3,
    "unknown": 4,
}


def _load_extra_domains(env_key: str) -> set:
    """Extend domain sets via comma-separated env var, without code changes."""
    raw = os.getenv(env_key, "")
    return {d.strip().lower() for d in raw.split(",") if d.strip()}


def hostname_matches_domain(hostname: str, known_domain: str) -> bool:
    """Boundary-safe domain match: exact or dot-separated subdomain only."""
    h = (hostname or "").lower().strip().rstrip(".")
    d = known_domain.lower().strip().rstrip(".")
    return h == d or h.endswith("." + d)


def _classify_host(host: str) -> str:
    """Return source_type for a hostname using boundary-safe matching."""
    for domain in KNOWN_MANUFACTURER_DOMAINS | _load_extra_domains("EVIDENCE_MANUFACTURER_DOMAINS"):
        if hostname_matches_domain(host, domain):
            return "manufacturer"
    for domain in KNOWN_DISTRIBUTOR_DOMAINS | _load_extra_domains("EVIDENCE_DISTRIBUTOR_DOMAINS"):
        if hostname_matches_domain(host, domain):
            return "distributor"
    for domain in KNOWN_SECONDARY_DOMAINS | _load_extra_domains("EVIDENCE_SECONDARY_DOMAINS"):
        if hostname_matches_domain(host, domain):
            return "secondary"
    return "unknown"


def classify_source(url: str) -> tuple:
    """Classify a URL into (source_type, authority_tier).

    Recognized domains map to their tier; anything unrecognized is
    ("unknown", 4). Classification affects ranking/confidence only —
    identity verification is enforced separately.
    """
    host = (urlparse(url).hostname or "").lower()
    return _classify_host(host), AUTHORITY_TIERS[_classify_host(host)]


@app.get("/")
async def root():
    provider = type(get_provider()).__name__
    return {"service": "evidence", "version": "1.0.0", "search_provider": provider}


@app.post("/evidence/check", response_model=EvidenceCheckResponse)
async def evidence_check(request: EvidenceCheckRequest):
    """Full pipeline: discovery -> retrieval -> sanitize -> verify -> extract."""
    # Whitespace-only inputs must behave exactly like absent inputs so that
    # blank organizer cells never fabricate search identity.
    manufacturer = (request.manufacturer or "").strip()
    brand = (request.brand or "").strip()
    mpn = (request.mpn or "").strip()
    description = (request.description or "").strip()
    category = (request.category or "").strip()
    missing = [f.strip() for f in (request.missing_fields or []) if f and f.strip()]

    # --- 1. Source discovery (skips entirely when identity is too weak) ---
    candidates, needs_search = discover_sources(manufacturer, brand, mpn, description)
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
    # Bug 1 hardening: attempt up to 3 candidates; an identity mismatch,
    # retrieval failure, or blocked URL on one candidate must never
    # terminate the search. First identity-matched candidate wins;
    # failures are reported only after ALL candidates are attempted.
    MAX_CANDIDATE_ATTEMPTS = 3

    # Ranking: classification affects ordering (tier 1 tried first), not identity.
    ranked = sorted(
        candidates[:MAX_CANDIDATE_ATTEMPTS],
        key=lambda c: AUTHORITY_TIERS.get(_classify_host((urlparse(c.get("url") or "").hostname or "")), 4),
    )

    attempts_made = 0
    best_reject_reason = None
    best_source_info: Optional[SourceInfo] = None
    best_identity_confidence = 0.0

    for candidate in ranked:
        url = candidate.get("url") or ""
        ok, _reason = validate_url(url)
        if not ok:
            if best_reject_reason is None:
                best_reject_reason = f"blocked/invalid URL skipped: {url}"
            continue

        retrieved = retrieve_url(url)
        if not retrieved:
            if best_reject_reason is None:
                best_reject_reason = f"retrieval failed: {url}"
            continue
        attempts_made += 1

        raw_text = sanitize_html(retrieved["content"])
        product_text = extract_product_text(raw_text)

        identity = verify_identity(
            manufacturer, mpn, brand, product_text
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
            # Keep the strongest rejection evidence; CONTINUE to next candidate.
            if identity["confidence"] >= best_identity_confidence:
                best_identity_confidence = identity["confidence"]
                best_source_info = source_info
                if identity["reject_reason"]:
                    best_reject_reason = identity["reject_reason"]
            continue

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

    # All candidates attempted — none identity-matched. Report gracefully
    # with the strongest rejection evidence collected across attempts.
    return EvidenceCheckResponse(
        success=True, needs_search=True, source=best_source_info,
        identity_match=False, identity_confidence=best_identity_confidence,
        reject_reason=best_reject_reason or (
            f"no candidate matched after {attempts_made} retrieval(s)"
            if attempts_made else "retrieval failed for all candidates"
        ),
        evidence=[], deterministic_fields={},
        needs_gemini=[], unresolved=missing,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("EVIDENCE_PORT", "8000")))
