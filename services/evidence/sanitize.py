"""HTML sanitization: strip scripts, styles, navigation; keep product evidence.

Never returns raw HTML to Gemini — only concise product-relevant text.
"""

import re
from typing import Optional

PRODUCT_KEYWORDS = [
    "manufacturer", "brand", "mpn", "part number", "model",
    "upc", "ean", "gtin", "sku",
    "weight", "dimension", "length", "width", "height", "depth",
    "warranty", "voltage", "current", "wattage", "power", "amperage",
    "rpm", "temperature", "pressure", "psi", "capacity",
    "material", "finish", "color", "pack", "quantity", "application",
    "specification", "features", "description",
]


def sanitize_html(html: Optional[str]) -> str:
    """Remove scripts/styles/nav/forms and return product-relevant text."""
    if not html:
        return ""

    from bs4 import BeautifulSoup

    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

    # Remove non-content elements entirely
    for tag in soup(["script", "style", "noscript", "iframe", "svg",
                     "nav", "form", "footer", "header", "aside"]):
        tag.decompose()

    # Remove HTML comments
    try:
        from bs4 import Comment
        for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
            comment.extract()
    except Exception:
        pass

    text = soup.get_text(separator=" ")

    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text


def extract_product_text(text: str, max_chars: int = 6000) -> str:
    """Filter sanitized text down to product-relevant sentences."""
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    relevant = []
    for sentence in sentences:
        s = sentence.strip()
        if not s:
            continue
        lower = s.lower()
        if any(kw in lower for kw in PRODUCT_KEYWORDS):
            relevant.append(s)
            if sum(len(r) for r in relevant) >= max_chars:
                break
    result = " ".join(relevant)
    # Fallback: if keyword filter found nothing usable, truncate raw text
    if not result:
        result = text[:max_chars]
    return result[:max_chars]
