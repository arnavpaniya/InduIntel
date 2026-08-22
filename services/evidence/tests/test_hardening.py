"""Stage 4.1 hardening tests: candidate iteration + source classification."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient

import app as evidence_app
from app import classify_source

client = TestClient(evidence_app.app)

WRONG_MPN_PAGE = {
    "content": "<html><body><p>Manufacturer: Acme Corporation</p>"
               "<p>MPN: XYZ789</p><p>Weight: 5 kg</p></body></html>",
    "final_url": "https://www.random-site.com/product/xyz789",
    "status_code": 200,
}
CORRECT_MPN_PAGE = {
    "content": "<html><body><p>Manufacturer: Acme Corporation</p>"
               "<p>MPN: ABC123</p><p>UPC: 123456789012</p>"
               "<p>Weight: 2.4 kg</p></body></html>",
    "final_url": "https://www.knownmfg-example.com/product/abc123",
    "status_code": 200,
}


def _payload(**kw):
    base = dict(manufacturer="Acme Corporation", brand="Acme", mpn="ABC123",
                description="Industrial widget for testing purposes here",
                category="", missing_fields=["upc", "weight"])
    base.update(kw)
    return base


# ---------- Bug 1: try ALL search candidates ----------

class TestCandidateIteration:
    def test_candidate1_wrong_mpn_candidate2_accepted(self, monkeypatch):
        calls = []

        def fake_discover(*a, **kw):
            return ([
                {"url": "https://www.random-site.com/product/xyz789"},
                {"url": "https://www.knownmfg-example.com/product/abc123"},
            ], True)

        def fake_retrieve(url):
            calls.append(url)
            if "random-site" in url:
                return WRONG_MPN_PAGE
            return CORRECT_MPN_PAGE

        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        resp = client.post("/evidence/check", json=_payload())
        data = resp.json()

        # Candidate 2 must be attempted despite candidate 1's mismatch
        assert len(calls) == 2, f"expected both candidates attempted, got {calls}"
        assert data["identity_match"] is True
        assert data["reject_reason"] is None
        assert "upc" in data["deterministic_fields"]
        assert data["deterministic_fields"]["upc"]["value"] == "123456789012"

    def test_all_candidates_wrong_unresolved(self, monkeypatch):
        attempts = []

        def fake_discover(*a, **kw):
            return ([{"url": f"https://site{i}.com/p"} for i in range(3)], True)

        def fake_retrieve(url):
            attempts.append(url)
            page = dict(WRONG_MPN_PAGE)
            page["final_url"] = url
            return page

        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        resp = client.post("/evidence/check", json=_payload())
        data = resp.json()

        # All three attempted before giving up
        assert len(attempts) == 3
        assert data["identity_match"] is False
        assert data["reject_reason"] is not None
        assert set(data["unresolved"]) == {"upc", "weight"}
        assert data["needs_gemini"] == []
        assert data["evidence"] == []

    def test_retrieval_failure_does_not_stop_search(self, monkeypatch):
        calls = []

        def fake_discover(*a, **kw):
            return ([
                {"url": "https://down-site.com/p"},       # retrieval fails
                {"url": "https://www.knownmfg-example.com/product/abc123"},
            ], True)

        def fake_retrieve(url):
            calls.append(url)
            if "down-site" in url:
                return None
            return CORRECT_MPN_PAGE

        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        resp = client.post("/evidence/check", json=_payload())
        data = resp.json()
        assert len(calls) == 2
        assert data["identity_match"] is True

    def test_blocked_url_does_not_stop_search(self, monkeypatch):
        calls = []

        def fake_discover(*a, **kw):
            return ([
                {"url": "http://localhost:9000/admin"},   # blocked by SSRF guard
                {"url": "https://www.knownmfg-example.com/product/abc123"},
            ], True)

        def fake_retrieve(url):
            calls.append(url)
            return CORRECT_MPN_PAGE

        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        resp = client.post("/evidence/check", json=_payload())
        data = resp.json()
        # localhost was skipped pre-retrieval; second candidate still fetched
        assert calls == ["https://www.knownmfg-example.com/product/abc123"]
        assert data["identity_match"] is True

    def test_max_three_attempts_enforced(self, monkeypatch):
        def fake_discover(*a, **kw):
            return ([{"url": f"https://site{i}.com/p"} for i in range(10)], True)

        def fake_retrieve(url):
            return dict(WRONG_MPN_PAGE, final_url=url)

        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        seen = []
        original = evidence_app.retrieve_url
        def counting_retrieve(url):
            seen.append(url)
            return original(url)
        monkeypatch.setattr(evidence_app, "retrieve_url", counting_retrieve)

        client.post("/evidence/check", json=_payload())
        assert len(seen) <= 3


# ---------- Bug 2: explicit source classification ----------

class TestSourceClassification:
    def test_known_manufacturer_domain(self, monkeypatch):
        monkeypatch.setattr(evidence_app, "KNOWN_MANUFACTURER_DOMAINS",
                            {"knownmanufacturer.com"})
        st, tier = classify_source("https://shop.knownmanufacturer.com/product/x")
        assert st == "manufacturer" and tier == 1

    def test_known_distributor_domain(self, monkeypatch):
        monkeypatch.setattr(evidence_app, "KNOWN_DISTRIBUTOR_DOMAINS",
                            {"knowndistributor.com"})
        st, tier = classify_source("https://www.knowndistributor.com/item")
        assert st == "distributor" and tier == 2

    def test_unknown_domain_tier4(self):
        st, tier = classify_source("https://random-example.com/product")
        assert st == "unknown" and tier == 4

    def test_www_subdomain_matches(self, monkeypatch):
        monkeypatch.setattr(evidence_app, "KNOWN_MANUFACTURER_DOMAINS",
                            {"knownmanufacturer.com"})
        st, _ = classify_source("https://www.knownmanufacturer.com/p")
        assert st == "manufacturer"

    def test_domain_boundary_safe(self, monkeypatch):
        monkeypatch.setattr(evidence_app, "KNOWN_MANUFACTURER_DOMAINS",
                            {"knownmanufacturer.com"})
        st, tier = classify_source("https://notknownmanufacturer.com/p")
        assert st == "unknown" and tier == 4

    def test_unknown_domain_with_exact_mpn_still_verifiable(self, monkeypatch):
        # Identity via evidence remains possible; source stays unknown/tier 4.
        def fake_discover(*a, **kw):
            return ([{"url": "https://random-forum.example.com/review"}], True)
        def fake_retrieve(url):
            return dict(CORRECT_MPN_PAGE, final_url=url)
        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        resp = client.post("/evidence/check", json=_payload())
        data = resp.json()
        assert data["identity_match"] is True          # evidence-based identity holds
        assert data["source"]["source_type"] == "unknown"
        assert data["source"]["authority_tier"] == 4   # never promoted

    def test_builtin_real_domains_classified(self):
        st, tier = classify_source("https://www.grainger.com/product/1")
        assert st == "distributor" and tier == 2
        st, tier = classify_source("https://www.milwaukeetool.com/en-us/x")
        assert st == "manufacturer" and tier == 1
