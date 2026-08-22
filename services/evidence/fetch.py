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
            # Manual redirect handling so every hop is validated
            with httpx.Client(
                timeout=REQUEST_TIMEOUT,
                follow_redirects=False,
                max_content_length=MAX_RESPONSE_SIZE,
            ) as client:
                current_url = url
                redirects = 0
                while True:
                    resp = client.get(current_url, headers=headers)

                    if resp.is_redirect or resp.is_redirect is False and resp.status_code in (301, 302, 303, 307, 308):
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
                        break  # give up this attempt, retry outer loop

                    if resp.status_code >= 400:
                        return None  # 4xx/5xx: do not crash pipeline

                    content = resp.text
                    if len(content.encode("utf-8", errors="ignore")) > MAX_RESPONSE_SIZE:
                        return None

                    final_ok, _ = validate_url(str(resp.url))
                    if not final_ok:
                        return None

                    return {
                        "content": content,
                        "final_url": str(resp.url),
                        "status_code": resp.status_code,
                        "redirect_count": redirects,
                    }
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
