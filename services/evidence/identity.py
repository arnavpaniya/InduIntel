"""Product identity verification: never enrich a product from a similar product."""

import re
from typing import Dict, Any, Optional


def normalize_mpn(mpn: Optional[str]) -> str:
    """Normalize an MPN for comparison: uppercase, strip separators/spaces."""
    if not mpn:
        return ""
    return re.sub(r"[\s\-_/\.]", "", mpn).upper()


def loose_mpn_form(text: str) -> str:
    """Uppercase text with separator runs collapsed to single spaces.

    Unlike full fusion, this preserves token boundaries so whole-word
    presence checks work even when neighbouring words exist
    ("MPN: MÜ-1 Gewicht" keeps "MÜ 1" delimited instead of fusing into
    "MÜ1GEWICHT").
    """
    if not text:
        return ""
    return re.sub(r"[\s\-_/\\.]+", " ", text).upper()


def normalize_name(name: Optional[str]) -> str:
    """Normalize a manufacturer/brand name for comparison."""
    if not name:
        return ""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def verify_identity(
    target_manufacturer: Optional[str],
    target_mpn: Optional[str],
    target_brand: Optional[str],
    page_text: str,
) -> Dict[str, Any]:
    """Verify the retrieved page actually pertains to this exact product.

    Exact MPN match is strongest. Wrong MPN => reject. Manufacturer mismatch
    => reject or low confidence. Returns dict:
      {identity_match, confidence, reject_reason}
    """
    result = {"identity_match": False, "confidence": 0.0, "reject_reason": None}

    if not page_text:
        result["reject_reason"] = "empty page text"
        return result

    text_lower = page_text.lower()
    norm_target_mpn = normalize_mpn(target_mpn)

    # --- 1. MPN check (strongest signal) ---
    if norm_target_mpn:
        # Find candidate MPNs on the page.
        # Character class [^\W_] = unicode letters + digits (no underscore),
        # so non-ASCII part numbers ("MÜ-1") are captured too.
        candidates = set()
        for m in re.finditer(r"(?:MPN|Part\s*Number|Manufacturer\s*Part\s*Number|Model)\s*[:#]?\s*([^\W_][\w\-/_\.]{2,30})", text_lower, re.IGNORECASE):
            candidates.add(normalize_mpn(m.group(1)))
        # Whole-word presence of the normalized MPN, checked against the
        # boundary-preserving loose form (fused text would glue the MPN to
        # neighbouring words and break the lookahead).
        loose_page = loose_mpn_form(page_text)
        bare_present = bool(re.search(
            r"(?<![A-Za-z0-9])" + re.escape(norm_target_mpn) + r"(?![A-Za-z0-9])",
            loose_page,
        ))

        if candidates or bare_present:
            if norm_target_mpn in candidates or bare_present:
                result["identity_match"] = True
                result["confidence"] = 0.99
                # fall through to manufacturer consistency check below
            else:
                # Page shows a *different* explicit MPN — reject hard
                result["reject_reason"] = f"different MPN on page (expected {norm_target_mpn})"
                return result

    # --- 2. Manufacturer consistency ---
    if target_manufacturer:
        norm_manu = normalize_name(target_manufacturer)
        manu_mentioned = norm_manu and norm_manu in normalize_name(page_text)
        if not manu_mentioned:
            if norm_target_mpn and result["identity_match"]:
                # Exact MPN matched but manufacturer absent: low confidence accept
                result["confidence"] = min(result.get("confidence", 0.5), 0.6)
            else:
                result["reject_reason"] = "manufacturer not found on page"
                result["identity_match"] = False
                result["confidence"] = 0.0
                return result

    # --- 3. Brand consistency (soft signal) ---
    if target_brand and not result["identity_match"]:
        if normalize_name(target_brand) in normalize_name(page_text):
            result["confidence"] = max(result.get("confidence", 0.0), 0.55)

    # Identity requires at least MPN or (manufacturer AND brand/description signal)
    if not result["identity_match"]:
        has_brand = target_brand and normalize_name(target_brand) in normalize_name(page_text)
        if target_manufacturer and has_brand:
            result["identity_match"] = True
            result["confidence"] = 0.65

    return result
