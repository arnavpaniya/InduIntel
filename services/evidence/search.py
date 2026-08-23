"""Configurable search provider abstraction for source discovery.

Never scrapes search engine HTML. Uses an API provider configured via
environment variables. Returns "search unavailable" when no provider is
configured.

Providers:
- TavilySearchProvider  — official Tavily Search API (POST, Bearer auth).
  Selected automatically when EVIDENCE_SEARCH_URL points at tavily.com.
- ApiSearchProvider     — generic REST provider (GET ?q= -> {"results":[...]})
  kept for local/mock and alternative providers.
- UnavailableProvider   — default when nothing is configured.

Tavily notes (verified against official docs):
- Endpoint : POST https://api.tavily.com/search
- Auth     : Authorization: Bearer <EVIDENCE_SEARCH_API_KEY>
- Body     : {"query": ..., "max_results": <=20, "search_depth": "basic",
              "include_answer": false}
- Response : {"results": [{"title": "...", "url": "..."}, ...], ...}
Only result URLs/titles are consumed here; Tavily's generated answer and
content snippets are NEVER used as product evidence — retrieval, sanitization,
identity verification, and extraction stay in the existing Stage 4 pipeline.
"""

import os
import time
from typing import Optional, Dict, Any, List


class SearchProvider:
    """Abstract search provider interface."""

    def search(self, query: str) -> Optional[List[Dict[str, Any]]]:
        raise NotImplementedError("search() must be implemented by a subclass")


class UnavailableProvider(SearchProvider):
    """Default provider when no search API is configured."""

    def search(self, query: str) -> Optional[List[Dict[str, Any]]]:
        return None


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, "") or default)
    except ValueError:
        return default


class ApiSearchProvider(SearchProvider):
    """Generic REST search provider configured via env vars.

    Requires EVIDENCE_SEARCH_URL (a GET endpoint taking ?q=) and optionally
    EVIDENCE_SEARCH_API_KEY sent as a Bearer token.
    """

    def __init__(self):
        import httpx
        self.url = os.getenv("EVIDENCE_SEARCH_URL", "")
        self.api_key = os.getenv("EVIDENCE_SEARCH_API_KEY", "")
        self.timeout = _env_float("EVIDENCE_SEARCH_TIMEOUT", 10)
        self._client = httpx

    def search(self, query: str) -> Optional[List[Dict[str, Any]]]:
        if not self.url:
            return None
        try:
            headers = {}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            resp = self._client.get(
                self.url,
                params={"q": query},
                headers=headers,
                timeout=self.timeout,
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            # Expect {"results": [{"url": ..., "title": ...}, ...]}
            results = data.get("results", []) if isinstance(data, dict) else []
            return [
                {"url": r.get("url"), "title": r.get("title", "")}
                for r in results
                if isinstance(r, dict) and r.get("url")
            ]
        except Exception:
            return None


class TavilySearchProvider(SearchProvider):
    """Official Tavily Search API provider.

    Env:
      EVIDENCE_SEARCH_URL      e.g. https://api.tavily.com/search
      EVIDENCE_SEARCH_API_KEY  the Tavily key (NEVER logged)

    Behavior:
      - POST JSON body; Bearer auth header.
      - Bounded max_results and bounded timeout.
      - ONE polite retry on 429 only; auth failures are never retried.
      - Any failure (missing config, HTTP error, timeout, malformed JSON,
        malformed entries) yields None => "no candidates" downstream.
      - The API key never appears in logs, errors, or returned data.
    """

    # Bounded discovery: enough candidates for Stage 4.1's MAX_CANDIDATE_ATTEMPTS
    # plus a little ranking headroom, far below Tavily's own cap of 20.
    MAX_RESULTS_DEFAULT = 8
    RETRY_BACKOFF_SECONDS = _env_float("EVIDENCE_SEARCH_RETRY_BACKOFF", 2)

    def __init__(self):
        self.url = os.getenv("EVIDENCE_SEARCH_URL", "")
        self.api_key = os.getenv("EVIDENCE_SEARCH_API_KEY", "")
        self.timeout = _env_float("EVIDENCE_SEARCH_TIMEOUT", 10)
        try:
            max_results = int(os.getenv("EVIDENCE_SEARCH_MAX_RESULTS", str(self.MAX_RESULTS_DEFAULT)))
        except ValueError:
            max_results = self.MAX_RESULTS_DEFAULT
        # Clamp to Tavily's documented maximum (20).
        self.MAX_RESULTS = min(max(max_results, 0), 20)
        if not self.api_key:
            # No key -> provider cannot function; report unavailable honestly.
            self._disabled_reason = "api key missing"
        elif not self.url:
            self._disabled_reason = "endpoint missing"
        else:
            self._disabled_reason = None

    def search(self, query: str) -> Optional[List[Dict[str, Any]]]:
        import httpx

        if self._disabled_reason or not query or not query.strip():
            return None

        headers = {"Authorization": f"Bearer {self.api_key}"}
        body = {
            "query": query,
            "max_results": self.MAX_RESULTS,
            "search_depth": "basic",       # 1 credit; relevance is sufficient —
            "include_answer": False,       # Tavily's generated answer is NOT evidence
            "include_raw_content": False,
        }

        attempts = 0
        while attempts < 2:  # bounded: initial attempt + one 429 retry
            attempts += 1
            try:
                resp = httpx.post(
                    self.url,
                    json=body,
                    headers=headers,
                    timeout=self.timeout,
                )
            except Exception:
                return None  # network/timeout/malformed request -> no candidates

            if resp.status_code == 200:
                return self._parse(resp)

            if resp.status_code == 429 and attempts < 2:
                # Respect the rate limit once, briefly; then give up.
                time.sleep(self.RETRY_BACKOFF_SECONDS)
                continue

            # 401/403 (bad key), 432/433 (plan limits), 4xx/5xx — never retried.
            return None

        return None

    def _parse(self, resp) -> Optional[List[Dict[str, Any]]]:
        try:
            data = resp.json()
        except Exception:
            return None
        if not isinstance(data, dict):
            return None
        results = data.get("results")
        if not isinstance(results, list):
            return None

        candidates: List[Dict[str, Any]] = []
        for r in results[: self.MAX_RESULTS]:  # hard bound regardless of API
            if not isinstance(r, dict):
                continue  # malformed entry ignored safely
            url = r.get("url")
            if not isinstance(url, str) or not url.strip():
                continue  # malformed entry ignored safely
            title = r.get("title") if isinstance(r.get("title"), str) else ""
            candidates.append({"url": url.strip(), "title": title})
        return candidates


def get_provider() -> SearchProvider:
    """Return the configured search provider, or UnavailableProvider."""
    url = os.getenv("EVIDENCE_SEARCH_URL", "")
    if url and "tavily.com" in url.lower():
        return TavilySearchProvider()
    if os.getenv("EVIDENCE_SEARCH_URL"):
        return ApiSearchProvider()
    return UnavailableProvider()


def build_queries(manufacturer, brand, mpn, description):
    """Build prioritized search queries. Identity must be sufficient."""
    queries = []
    if manufacturer and mpn:
        queries.append(f"{manufacturer} {mpn} product specifications")
    if brand and mpn:
        queries.append(f"{brand} {mpn} datasheet")
    strong_desc = bool(description) and len(description.strip()) > 30
    if manufacturer and strong_desc:
        queries.append(f"{manufacturer} {description[:80]}")
    return queries


def discover_sources(manufacturer, brand, mpn, description):
    """Run discovery in priority order. Returns list of candidate URLs or [].

    Returns [] (not a search) when identity is too weak.
    """
    queries = build_queries(manufacturer, brand, mpn, description)
    if not queries:
        return [], False  # insufficient identity — no search performed

    provider = get_provider()
    candidates = []
    for q in queries:
        results = provider.search(q)
        if results is None:
            continue  # provider unavailable for this call
        candidates.extend(results)
        if candidates:
            break  # first successful tier wins
    return candidates, True
