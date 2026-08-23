"""E2E fixture wrapper around the REAL Stage 4 evidence service.

Everything stays authentic — discovery, candidate iteration, ranking,
sanitization, identity verification, deterministic extraction — except the
HTTP retrieval itself, which is hermetic (in-memory fixture pages) because
Stage 4.1's SSRF guard correctly refuses loopback fetch targets.

The search layer runs for real against the mock SEARCH API server started by
the TS harness (search.py performs no SSRF validation on its configured
provider endpoint).
"""

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "services", "evidence"))

import uvicorn  # noqa: E402

import app as evidence_app  # noqa: E402
from urllib.parse import urlparse  # noqa: E402

# --- diagnostics: surface search-provider failures normally swallowed ---
import search as _search_mod  # noqa: E402

_real_provider_search = _search_mod.ApiSearchProvider.search


def _logging_search(self, query):
    result = _real_provider_search(self, query)
    if result is None:
        try:
            import httpx
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            r = httpx.get(self.url, params={"q": query}, headers=headers, timeout=self.timeout)
            print(f"[PROVIDER] retry status={r.status_code} body={r.text[:120]!r}", file=sys.stderr, flush=True)
        except Exception as exc:
            import traceback
            print(f"[PROVIDER] EXC {exc!r}", file=sys.stderr, flush=True)
            traceback.print_exc(file=sys.stderr)
    return result


_search_mod.ApiSearchProvider.search = _logging_search
try:
    import search as _sm  # rebind references already imported into app namespace
except Exception:
    pass

# The e2e harness serves fixture pages from a local mock web server. Stage 4.1's
# SSRF guard correctly blocks loopback targets, so this wrapper admits EXACTLY
# ONE additional host — the fixture web root supplied via env — while every
# other URL keeps flowing through the untouched real validator.
FIXTURE_WEB_ROOT = os.getenv("EVIDENCE_FIXTURE_WEB_ROOT", "")
_real_validate_url = evidence_app.validate_url


def fixture_aware_validate_url(url):
    if FIXTURE_WEB_ROOT:
        try:
            parsed = urlparse(url)
            base = urlparse(FIXTURE_WEB_ROOT)
            if (
                parsed.scheme in ("http", "https")
                and (parsed.hostname or "") == (base.hostname or "")
                and (parsed.port or (443 if base.scheme == "https" else 80))
                == (base.port or (443 if base.scheme == "https" else 80))
            ):
                return True, ""
        except Exception:
            pass
    return _real_validate_url(url)


evidence_app.validate_url = fixture_aware_validate_url


def _fixture_page(kind: str, token: str, idx: int) -> str:
    if kind == "det":
        return f"""<html><head><title>{token}</title></head><body>
<h1>Zephyr Dynamics {token}</h1>
<p>Manufacturer: Zephyr Dynamics</p>
<p>MPN: {token}</p>
<p>UPC: {_upc12(idx + 1)}</p>
<p>EAN: {_ean13(idx + 1)}</p>
<p>GTIN-14: {_gtin14(idx + 1)}</p>
<p>Weight: 4.2 kg</p>
<p>Length: 300 mm Width: 150 mm Height: 75 mm</p>
<p>Warranty: 2 years limited.</p>
</body></html>"""
    if kind == "amb":
        return f"""<html><body>
<h1>Nordwind Elektrotechnik {token}</h1>
<p>Manufacturer: Nordwind Elektrotechnik</p>
<p>MPN: {token}</p>
<p>Weight: 6.4 kg</p>
<p>Application: suitable for continuous duty in wet locations with high vibration.</p>
<p>Features robust housing and conformal coated electronics for harsh sites.</p>
</body></html>"""
    if kind == "wrong":
        return """<html><body>
<p>Manufacturer: Cascadia Motors Group</p>
<p>MPN: OTHER-999-DIFFERENT</p>
<p>Weight: 9 kg</p>
</body></html>"""
    if kind == "conf":
        return f"""<html><body>
<p>Manufacturer listing for {token}.</p>
<p>MPN: {token}</p>
<p>UPC: {_upc12(idx + 101)}</p>
<p>Weight: 3 kg</p>
<p>Warranty: 1 year</p>
</body></html>"""
    return "<html><body><p>empty placeholder page</p></body></html>"


def _check_digit(digits: str) -> int:
    total = 0
    pos = 0
    for ch in reversed(digits):
        total += int(ch) * (3 if pos % 2 == 0 else 1)
        pos += 1
    return (10 - (total % 10)) % 10


def _upc12(seed: int) -> str:
    base = str(36000000000 + seed * 7919)[:11]
    return base + str(_check_digit(base))


def _ean13(seed: int) -> str:
    base = ("40" + str(63813339300 + seed * 104729))[:12]
    return base + str(_check_digit(base))


def _gtin14(seed: int) -> str:
    base = ("0012345678" + str(9000 + seed * 13))[:13]
    return base + str(_check_digit(base))


def fake_retrieve(url: str):
    """Hermetic retrieval: parse kind/token from any URL shape and serve."""
    path = re.sub(r"^https?://[^/]+/", "", url or "")
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2:
        kind = parts[0].replace(".html", "")
        token = parts[1].replace(".html", "")
        m = re.search(r"[?&]i=(\d+)", url or "")
        idx = int(m.group(1)) if m else 0
        return {
            "content": _fixture_page(kind, token, idx),
            "final_url": url,
            "status_code": 200,
            "redirect_count": 0,
        }
    return None


evidence_app.retrieve_url = fake_retrieve

# Startup identity token: the TS harness verifies THIS process (not a stale
# orphan) owns the port before talking to it.
FIXTURE_TOKEN = os.getenv("EVIDENCE_FIXTURE_TOKEN", "fixture")


@evidence_app.app.get("/__fixture_ping")
async def _fixture_ping():
    return {"token": FIXTURE_TOKEN, "pid": os.getpid()}


# --- request tracing (e2e diagnostics only) ---
LOG_PATH = os.getenv("EVIDENCE_TRACE_LOG", "")


@evidence_app.app.middleware("http")
async def _trace_middleware(request, call_next):
    response = await call_next(request)
    if LOG_PATH:
        try:
            with open(LOG_PATH, "a") as fh:
                fh.write(f"{request.method} {request.url.path}\n")
        except Exception:
            pass
    return response


if __name__ == "__main__":
    uvicorn.run(
        evidence_app.app,
        host="127.0.0.1",
        port=int(os.getenv("EVIDENCE_PORT", "8000")),
        log_level="error",
    )
