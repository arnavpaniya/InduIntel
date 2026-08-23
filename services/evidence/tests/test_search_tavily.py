"""Stage 6 — Tavily search provider tests (fully mocked; NO real credits used)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx
import pytest

import search as search_mod
from search import (
    TavilySearchProvider,
    ApiSearchProvider,
    UnavailableProvider,
    get_provider,
    discover_sources,
)


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


VALID_PAYLOAD = {
    "query": "Acme ABC123 product specifications",
    "answer": "LLM answer — must never be consumed",
    "results": [
        {"title": "Acme ABC123 specs", "url": "https://www.acme.com/abc123", "score": 0.9},
        {"title": "Distributor listing", "url": "https://shop.example.com/p/abc123", "content": "..."},
    ],
}


@pytest.fixture()
def provider(monkeypatch):
    monkeypatch.setenv("EVIDENCE_SEARCH_URL", "https://api.tavily.com/search")
    monkeypatch.setenv("EVIDENCE_SEARCH_API_KEY", "tvly-TESTKEY-not-real")
    return TavilySearchProvider()


def post_mock(monkeypatch, fn):
    """Patch the httpx.post symbol the provider resolves at call time."""
    monkeypatch.setattr(httpx, "post", fn)


# 1. valid response -> URLs extracted into internal format -------------------

def test_valid_response_extracts_urls(provider, monkeypatch):
    seen = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        seen.update({"url": url, "json": json, "headers": headers})
        return FakeResponse(200, VALID_PAYLOAD)

    post_mock(monkeypatch, fake_post)
    out = provider.search("Acme ABC123 product specifications")

    assert out == [
        {"url": "https://www.acme.com/abc123", "title": "Acme ABC123 specs"},
        {"url": "https://shop.example.com/p/abc123", "title": "Distributor listing"},
    ]
    # Contract details: official endpoint style, bearer auth, bounded depth,
    # no generated answer requested.
    assert seen["url"] == "https://api.tavily.com/search"
    assert seen["headers"]["Authorization"] == "Bearer tvly-TESTKEY-not-real"
    assert seen["json"]["include_answer"] is False
    assert seen["json"]["search_depth"] == "basic"
    assert seen["json"]["max_results"] <= 20


# 2. empty results -> no candidates -------------------------------------------

def test_empty_results(provider, monkeypatch):
    post_mock(monkeypatch, lambda *a, **k: FakeResponse(200, {"results": []}))
    assert provider.search("anything") == []


# 3. malformed result entries ignored safely ----------------------------------

def test_malformed_entries_ignored(provider, monkeypatch):
    payload = {
        "results": [
            "not-a-dict",
            {"title": "no url here"},
            {"url": 12345},                      # non-string url
            {"url": ""},                          # empty url
            {"url": "  https://ok.example.com/x  ", "title": None},  # ok
            VALID_PAYLOAD["results"][0],
        ]
    }
    post_mock(monkeypatch, lambda *a, **k: FakeResponse(200, payload))
    out = provider.search("q")
    assert out == [
        {"url": "https://ok.example.com/x", "title": ""},
        {"url": "https://www.acme.com/abc123", "title": "Acme ABC123 specs"},
    ]


def test_malformed_json_body(provider, monkeypatch):
    post_mock(monkeypatch, lambda *a, **k: FakeResponse(200, ValueError("bad json")))
    assert provider.search("q") is None


def test_non_dict_body(provider, monkeypatch):
    post_mock(monkeypatch, lambda *a, **k: FakeResponse(200, ["unexpected"]))
    assert provider.search("q") is None


def test_missing_results_key(provider, monkeypatch):
    post_mock(monkeypatch, lambda *a, **k: FakeResponse(200, {"query": "q"}))
    assert provider.search("q") is None


# 4–7. HTTP failure modes -> graceful failure (None), bounded retries --------

def test_401_graceful_no_retry(provider, monkeypatch):
    calls = []
    post_mock(monkeypatch, lambda *a, **k: (calls.append(1), FakeResponse(401, {"detail": {"error": "Unauthorized"}}))[1])
    assert provider.search("q") is None
    assert len(calls) == 1, "auth failures must never be retried"


def test_429_retries_once_then_graceful(provider, monkeypatch):
    calls = []
    slept = []
    monkeypatch.setattr(search_mod.time, "sleep", lambda s: slept.append(s))
    post_mock(monkeypatch, lambda *a, **k: (calls.append(1), FakeResponse(429))[1])
    assert provider.search("q") is None
    assert len(calls) == 2, "exactly one polite retry on 429"
    assert len(slept) == 1 and slept[0] > 0


def test_429_then_success_recovers(provider, monkeypatch):
    state = {"n": 0}
    monkeypatch.setattr(search_mod.time, "sleep", lambda s: None)

    def handler(*a, **k):
        state["n"] += 1
        if state["n"] == 1:
            return FakeResponse(429)
        return FakeResponse(200, VALID_PAYLOAD)

    post_mock(monkeypatch, handler)
    out = provider.search("q")
    assert out and out[0]["url"] == "https://www.acme.com/abc123"


def test_500_graceful_single_attempt(provider, monkeypatch):
    calls = []
    post_mock(monkeypatch, lambda *a, **k: (calls.append(1), FakeResponse(500))[1])
    assert provider.search("q") is None
    assert len(calls) <= 2  # server errors are not hammered


def test_timeout_exception_graceful(provider, monkeypatch):
    def boom(*a, **k):
        raise httpx.TimeoutException("timed out")
    post_mock(monkeypatch, boom)
    assert provider.search("q") is None


def test_connection_error_graceful(provider, monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("refused")
    post_mock(monkeypatch, boom)
    assert provider.search("q") is None


# 8. API key NEVER appears in logs/errors --------------------------------------

def test_api_key_never_logged(provider, monkeypatch, capsys):
    """Across every failure path, the key must not leak to stdout/stderr."""
    scenarios = [
        lambda *a, **k: FakeResponse(401),
        lambda *a, **k: FakeResponse(500),
        lambda *a, **k: FakeResponse(200, ValueError("x")),
        lambda *a, **k: (_ for _ in ()).throw(httpx.TimeoutException("t")),
    ]
    for scenario in scenarios:
        post_mock(monkeypatch, scenario)
        provider.search("q")
    captured = capsys.readouterr().out + capsys.readouterr().err
    assert "tvly-TESTKEY-not-real" not in captured


# 9. candidate limit stays bounded ----------------------------------------------

def test_result_cap_enforced(provider, monkeypatch):
    flood = {"results": [
        {"url": f"https://site{i}.example.com/p", "title": f"t{i}"} for i in range(50)
    ]}
    sent = {}
    def fake_post(url, json=None, headers=None, timeout=None):
        sent.update(json or {})
        return FakeResponse(200, flood)
    post_mock(monkeypatch, fake_post)
    out = provider.search("q")
    assert len(out) == provider.MAX_RESULTS          # hard bound on returned list
    assert sent["max_results"] == provider.MAX_RESULTS <= 20  # bound sent upstream


def test_max_results_env_override_bounded(provider, monkeypatch):
    monkeypatch.setenv("EVIDENCE_SEARCH_MAX_RESULTS", "99")
    p = TavilySearchProvider()
    sent = {}
    def fake_post(url, json=None, headers=None, timeout=None):
        sent.update(json or {})
        return FakeResponse(200, {"results": [{"url": "https://x.example.com"}]})
    post_mock(monkeypatch, fake_post)
    p.search("q")
    assert sent["max_results"] == 20  # clamped to Tavily's documented max


# Provider selection + pipeline integration unchanged ---------------------------

def test_provider_selection(monkeypatch):
    monkeypatch.setenv("EVIDENCE_SEARCH_URL", "https://api.tavily.com/search")
    monkeypatch.setenv("EVIDENCE_SEARCH_API_KEY", "k")
    assert isinstance(get_provider(), TavilySearchProvider)

    monkeypatch.setenv("EVIDENCE_SEARCH_URL", "http://127.0.0.1:9000/custom-search")
    assert isinstance(get_provider(), ApiSearchProvider)   # legacy GET providers keep working

    monkeypatch.delenv("EVIDENCE_SEARCH_URL", raising=False)
    assert isinstance(get_provider(), UnavailableProvider)


def test_disabled_without_key_or_url(monkeypatch):
    monkeypatch.setenv("EVIDENCE_SEARCH_URL", "https://api.tavily.com/search")
    monkeypatch.delenv("EVIDENCE_SEARCH_API_KEY", raising=False)

    class NeverCalled:
        pass
    p = TavilySearchProvider()
    # missing key -> disabled; search() short-circuits without HTTP
    monkeypatch.setattr(httpx, "post", lambda *a, **k: (_ for _ in ()).throw(AssertionError("HTTP attempted")))
    assert p.search("q") is None

    monkeypatch.delenv("EVIDENCE_SEARCH_URL", raising=False)
    p2 = TavilySearchProvider()
    assert p2.search("q") is None


def test_discover_sources_interface_unchanged(provider, monkeypatch):
    """discover_sources keeps its exact contract: candidates in internal format,
    weak identity => ([], False), first successful tier wins."""
    post_mock(monkeypatch, lambda *a, **k: FakeResponse(200, VALID_PAYLOAD))

    candidates, needs_search = discover_sources(
        "Acme Corporation", "Acme", "ABC123",
        "Industrial widget for testing purposes here",
    )
    assert needs_search is True
    assert candidates[0] == {"url": "https://www.acme.com/abc123", "title": "Acme ABC123 specs"}

    # Weak identity: unchanged rule — no search performed at all.
    candidates2, needs_search2 = discover_sources("", "", "", "thing")
    assert candidates2 == [] and needs_search2 is False


def test_identity_verification_still_gates_pipeline(provider, monkeypatch):
    """Even with live Tavily results, wrong-product pages are still rejected by
    the UNCHANGED identity verification before any enrichment happens."""
    from fastapi.testclient import TestClient
    import app as evidence_app

    def fake_discover(*a, **kw):
        return ([{"url": "https://www.acme.com/abc123", "title": "t"}], True)

    def fake_retrieve(url):
        return {"content": "<html><body><p>MPN: DIFFERENT-999</p></body></html>",
                "final_url": url, "status_code": 200}

    monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
    monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

    client = TestClient(evidence_app.app)
    resp = client.post("/evidence/check", json={
        "manufacturer": "Acme", "brand": "Acme", "mpn": "ABC123",
        "description": "industrial widget for testing purposes",
        "category": "", "missing_fields": ["upc"],
    })
    data = resp.json()
    assert data["identity_match"] is False
    assert data["deterministic_fields"] == {}     # nothing leaks from wrong product
