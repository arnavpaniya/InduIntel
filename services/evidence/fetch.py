"""SSRF-safe HTTP retrieval with bounded redirects, size limits, and retries."""

import os
import time
from typing import Optional, Dict, Any

from security import validate_url

MAX_REDIRECTS = int(os.getenv("EVIDENCE_MAX_REDIRECTS", "5"))
MAX_RESPONSE_SIZE = int(os.getenv("EVIDENCE_MAX_RESPONSE_SIZE", str(1024 * 1024)))
REQUEST_TIMEOUT = float(os.getenv("EVIDENCE_REQUEST_TIMEOUT", "10"))
MAX_RETRIES = 2
USER_AGENT = "UniHackEvidenceService/1.0 (product enrichment; contact: internal)"


def _bounded_get(client, url: str, headers: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """Single GET with enforced redirect hops and a REAL response-size cap.

    Streams the body and aborts as soon as more than MAX_RESPONSE_SIZE bytes
    are seen (declared Content-Length is also checked first).
    Returns {"content","final_url","status_code","redirect_count"} or None.
    """
    current_url = url
    redirects = 0

    while True:
        with client.stream("GET", current_url, headers=headers) as resp:
            # --- Redirect handling: validate EVERY hop -------------------
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("location")
                if not location:
                    return None
                redirects += 1
                if redirects > MAX_REDIRECTS:
                    return None
                from urllib.parse import urljoin
                next_url = urljoin(current_url, location)
                ok, _ = validate_url(next_url)
                if not ok:
                    return None
                current_url = next_url
                continue

            if resp.status_code == 429:
                retry_after = resp.headers.get("retry-after")
                wait = float(retry_after) if (retry_after or "").isdigit() else 2.0
                time.sleep(min(wait, 10.0))
                return {"__rate_limited__": True}  # signal caller to retry outer loop

            if resp.status_code >= 400:
                return None  # 4xx/5xx: do not crash pipeline

            # --- Enforce the response-size limit for real -----------------
            declared = resp.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > MAX_RESPONSE_SIZE:
                return None

            raw = bytearray()
            for chunk in resp.iter_raw():
                raw.extend(chunk)
                if len(raw) > MAX_RESPONSE_SIZE:
                    return None  # over budget even without Content-Length

            final_url = str(resp.url)
            ok, _ = validate_url(final_url)
            if not ok:
                return None

            charset = getattr(resp, "charset_encoding", None) or "utf-8"
            try:
                content = bytes(raw).decode(charset, errors="ignore")
            except LookupError:
                content = bytes(raw).decode("utf-8", errors="ignore")

            return {
                "content": content,
                "final_url": final_url,
                "status_code": resp.status_code,
                "redirect_count": redirects,
            }


def retrieve_url(url: str) -> Optional[Dict[str, Any]]:
    """Safely fetch a URL. Returns dict with content/final_url/status_code or None.

    Never raises — retrieval failures return None so the pipeline continues.
    """
    import httpx

    ok, reason = validate_url(url)
    if not ok:
        return None

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    for attempt in range(MAX_RETRIES + 1):
        try:
            with httpx.Client(
                timeout=REQUEST_TIMEOUT,
                follow_redirects=False,
            ) as client:
                result = _bounded_get(client, url, headers)

                if result is None:
                    return None

                if result.get("__rate_limited__"):
                    continue  # give up this attempt; retry outer loop

                return result
        except httpx.TimeoutException:
            return None
        except httpx.HTTPError:
            # Retry on transient network errors, then give up
            if attempt < MAX_RETRIES:
                time.sleep(1.0 * (attempt + 1))
                continue
            return None
        except Exception:
            return None
    return None
