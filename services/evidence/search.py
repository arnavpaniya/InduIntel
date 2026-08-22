"""Configurable search provider abstraction for source discovery.

Never scrapes search engine HTML. Uses an API provider configured via
environment variables. Returns "search unavailable" when no provider is
configured.
"""

import os
from typing import Optional, Dict, Any, List


class SearchProvider:
    """Abstract search provider interface."""

    def search(self, query: str) -> Optional[List[Dict[str, Any]]]:
        raise NotImplementedError("search() must be implemented by a subclass")


class UnavailableProvider(SearchProvider):
    """Default provider when no search API is configured."""

    def search(self, query: str) -> Optional[List[Dict[str, Any]]]:
        return None


class ApiSearchProvider(SearchProvider):
    """Generic REST search provider configured via env vars.

    Requires EVIDENCE_SEARCH_URL (a GET endpoint taking ?q=) and optionally
    EVIDENCE_SEARCH_API_KEY sent as a Bearer token.
    """

    def __init__(self):
        import httpx
        self.url = os.getenv("EVIDENCE_SEARCH_URL", "")
        self.api_key = os.getenv("EVIDENCE_SEARCH_API_KEY", "")
        self.timeout = float(os.getenv("EVIDENCE_SEARCH_TIMEOUT", "10"))
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


def get_provider() -> SearchProvider:
    """Return the configured search provider, or UnavailableProvider."""
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
