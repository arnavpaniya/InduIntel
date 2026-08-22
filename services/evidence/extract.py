"""Deterministic field extraction from sanitized product text.

Pure regex + normalization. If a value is unambiguous, return it as
deterministic — Gemini is NOT called for these fields.
"""

import re
from typing import Dict, Any, Optional

# Field patterns: (canonical_field_name, compiled_regex, confidence)
PATTERNS = [
    ("upc", re.compile(r"\bUPC\b\s*[:#]?\s*([0-9]{6,14})\b", re.IGNORECASE), 0.98),
    ("ean", re.compile(r"\bEAN\b\s*[:#]?\s*([0-9]{8,13})\b", re.IGNORECASE), 0.97),
    ("gtin", re.compile(r"\bGTIN(?:-\d+)?\b\s*[:#]?\s*([0-9]{8,14})\b", re.IGNORECASE), 0.96),
    ("weight", re.compile(r"\b(?:Weight|Shipping Weight|Net Weight)\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(kg|kilogram|g|gram|lbs?|lb|pound|oz|ounce)\b\.?", re.IGNORECASE), 0.92),
    ("length", re.compile(r"\bLength\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|millimeter|cm|centimeter|m|meter|in|inch(?:es)?|ft|feet)\b\.?", re.IGNORECASE), 0.90),
    ("width", re.compile(r"\bWidth\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|millimeter|cm|centimeter|m|meter|in|inch(?:es)?|ft|feet)\b\.?", re.IGNORECASE), 0.90),
    ("height", re.compile(r"\bHeight\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|millimeter|cm|centimeter|m|meter|in|inch(?:es)?|ft|feet)\b\.?", re.IGNORECASE), 0.90),
    ("depth", re.compile(r"\bDepth\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|millimeter|cm|centimeter|m|meter|in|inch(?:es)?|ft|feet)\b\.?", re.IGNORECASE), 0.88),
    ("warranty", re.compile(r"\bWarranty\b\s*[:#]?\s*([^.]{2,80}?)(?:\.|$)", re.IGNORECASE), 0.88),
    ("voltage", re.compile(r"\bVoltage(?:\s*Rating)?\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(V|Volts?|mV|kV)\b\.?", re.IGNORECASE), 0.93),
    ("current", re.compile(r"\b(?:Current|Amperage|Amps?)\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(A|Amps?|Amperes?|mA)\b\.?", re.IGNORECASE), 0.92),
    ("power", re.compile(r"\b(?:Power|Wattage)\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(W|Watts?|kW)\b\.?", re.IGNORECASE), 0.92),
    ("rpm", re.compile(r"\b(?:Max\s*)?RPM\b\s*[:#]?\s*([0-9][0-9,]*)\b", re.IGNORECASE), 0.90),
    ("pressure", re.compile(r"\bPressure\b\s*[:#]?\s*([0-9]+(?:\.[0-9]+)?)\s*(psi|PSI|bar|kPa|Pa)\b\.?", re.IGNORECASE), 0.90),
    ("temperature", re.compile(r"\bTemperature(?:\s*Range|\s*Rating)?\b\s*[:#]?\s*(-?[0-9]+(?:\.[0-9]+)?)\s*(°?C|°?F|Celsius|Fahrenheit)\b\.?", re.IGNORECASE), 0.90),
    ("pack_quantity", re.compile(r"\bPack(?:\s*of|\s*Quantity|\s*Size)?\s*[:#]?\s*([0-9]{1,3})\b", re.IGNORECASE), 0.85),
]

UOM_NORMALIZATION = {
    "kg": "kg", "kilogram": "kg", "kilograms": "kg",
    "g": "g", "gram": "g", "grams": "g",
    "lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
    "oz": "oz", "ounce": "oz", "ounces": "oz",
    "mm": "mm", "millimeter": "mm", "millimeters": "mm",
    "cm": "cm", "centimeter": "cm", "centimeters": "cm",
    "m": "m", "meter": "m", "meters": "m",
    "in": "in", "inch": "in", "inches": "in",
    "ft": "ft", "feet": "ft",
    "v": "V", "volts": "V", "volt": "V", "mv": "mV", "kv": "kV",
    "a": "A", "amps": "A", "amp": "A", "amperes": "A", "ma": "mA",
    "w": "W", "watts": "W", "watt": "W", "kw": "kW",
    "psi": "psi", "bar": "bar", "kpa": "kPa", "pa": "Pa",
    "c": "C", "f": "F", "celsius": "C", "fahrenheit": "F",
}


def normalize_uom(uom: str) -> str:
    key = (uom or "").strip().lower()
    return UOM_NORMALIZATION.get(key, uom)


def normalize_number(raw: str) -> float:
    """Parse '1,234.5' style numbers to float."""
    return float(raw.replace(",", ""))


def extract_deterministic_fields(text: str, source_url: str = "") -> Dict[str, Dict[str, Any]]:
    """Extract deterministic fields.

    Returns {field: {"value","uom","evidence","source_url","confidence"}}.
    Only unambiguous matches are returned.
    """
    results: Dict[str, Dict[str, Any]] = {}
    if not text:
        return results

    for field, pattern, confidence in PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        groups = match.groups()
        raw_value = groups[0]
        uom_raw = groups[1] if len(groups) > 1 else ""
        evidence = match.group(0).strip()

        entry: Dict[str, Any] = {
            "value": None,
            "uom": "",
            "evidence": evidence,
            "source_url": source_url,
            "confidence": confidence,
        }

        try:
            if field == "warranty":
                value = raw_value.strip().rstrip(".,;")
                # Reject obviously non-warranty noise (too long / no digits)
                if len(value) > 60 or not any(ch.isdigit() for ch in value):
                    continue
                entry["value"] = value
            elif field == "pack_quantity":
                entry["value"] = int(raw_value)
            elif field in ("upc", "ean", "gtin"):
                digits = raw_value.strip()
                # Sanity: must be all digits (regex already enforces) —
                # accept the matched length; ambiguity handled by identity check.
                if not digits.isdigit():
                    continue
                entry["value"] = digits
            else:
                numeric = normalize_number(raw_value)
                entry["value"] = numeric
                entry["uom"] = normalize_uom(uom_raw or "")
        except (ValueError, IndexError):
            continue

        results[field] = entry

    return results


def split_dimensions(fields: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Return the dimensions sub-dict (length/width/height/depth entries)."""
    dims = {}
    for k in ("length", "width", "height", "depth"):
        if k in fields:
            dims[k] = fields[k]
    return dims


def determine_gemini_needs(
    missing_fields, deterministic_fields, evidence_available
):
    """Split missing_fields into needs_gemini vs unresolved.

    - resolved deterministically -> excluded from both
    - ambiguous but evidence present -> needs_gemini
    - no useful evidence -> unresolved
    """
    needs_gemini = []
    unresolved = []
    for f in missing_fields or []:
        base = f.lower()
        if base in deterministic_fields or (
            base == "dimensions" and any(k in deterministic_fields for k in ("length", "width", "height", "depth"))
        ):
            continue  # already resolved deterministically
        if evidence_available:
            needs_gemini.append(f)
        else:
            unresolved.append(f)
    return needs_gemini, unresolved
