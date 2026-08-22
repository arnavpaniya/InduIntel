"""Unit and value normalization for extracted evidence."""

from typing import Optional, Tuple

# Weight conversions to kg
WEIGHT_TO_KG = {
    "kg": 1.0, "g": 0.001, "lb": 0.45359237, "oz": 0.028349523125,
}

# Length conversions to mm
LENGTH_TO_MM = {
    "mm": 1.0, "cm": 10.0, "m": 1000.0,
    "in": 25.4, "ft": 304.8,
}

TEMP_C_OFFSET = {"C": 0.0, "F": -17.7777777777778}


def convert_weight(value: float, uom: str) -> Tuple[Optional[float], str]:
    """Convert weight to canonical kg. Returns (value_kg, 'kg') or (None,'')."""
    factor = WEIGHT_TO_KG.get((uom or "").lower())
    if factor is None or value is None:
        return None, ""
    return round(value * factor, 6), "kg"


def convert_length(value: float, uom: str) -> Tuple[Optional[float], str]:
    """Convert length to canonical mm. Returns (value_mm, 'mm') or (None,'')."""
    factor = LENGTH_TO_MM.get((uom or "").lower())
    if factor is None or value is None:
        return None, ""
    return round(value * factor, 4), "mm"


def celsius_to_fahrenheit(c: float) -> float:
    return round(c * 9.0 / 5.0 + 32.0, 2)


def fahrenheit_to_celsius(f: float) -> float:
    return round((f - 32.0) * 5.0 / 9.0, 2)


def normalize_field(field: str, value, uom: str):
    """Normalize a field value + uom into canonical form.

    Returns (normalized_value, normalized_uom) — unchanged when no rule applies.
    """
    if field == "weight" and isinstance(value, (int, float)):
        return convert_weight(value, uom)
    if field in ("length", "width", "height", "depth") and isinstance(value, (int, float)):
        return convert_length(value, uom)
    if field == "temperature" and isinstance(value, (int, float)):
        u = (uom or "").upper().replace("°", "")
        if u == "F":
            return fahrenheit_to_celsius(value), "C"
        if u == "C":
            return value, "C"
        return value, uom
    return value, uom
