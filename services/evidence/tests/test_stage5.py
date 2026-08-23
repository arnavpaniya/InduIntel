"""Stage 5 robustness tests: arbitrary input tolerance, degradation,
duplicate candidates, conflicting sources, security regressions."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient

import app as evidence_app
from app import classify_source
from security import is_blocked_host, validate_url
from identity import normalize_mpn, normalize_name

client = TestClient(evidence_app.app)


def _payload(**kw):
    base = dict(manufacturer="", brand="", mpn="", description="",
                category="", missing_fields=[])
    base.update(kw)
    return base


# ---------- Arbitrary / hostile request inputs ----------

class TestArbitraryInputs:
    def test_all_empty_strings(self):
        r = client.post("/evidence/check", json=_payload())
        assert r.status_code == 200
        data = r.json()
        assert data["needs_search"] is False
        assert data["unresolved"] == []

    def test_whitespace_only_fields(self):
        r = client.post("/evidence/check", json=_payload(
            manufacturer="   ", brand="\t\n", mpn="  ", description=" \r\n "))
        assert r.status_code == 200
        assert r.json()["needs_search"] is False

    def test_unicode_manufacturer_and_description(self, monkeypatch):
        def fake_discover(*a, **kw):
            return ([{"url": "https://shop.example.com/p/ü"}], True)
        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(
            evidence_app, "retrieve_url",
            lambda url: {
                "content": "<html><body><p>Hersteller: Müller & Söhne</p>"
                           "<p>MPN: MÜ-1</p><p>Weight: 3 kg</p></body></html>",
                "final_url": url, "status_code": 200,
            })
        r = client.post("/evidence/check", json=_payload(
            manufacturer="Müller & Söhne", mpn="MÜ-1",
            description="Präzisionswerkzeug ✓ 日本語", missing_fields=["weight"]))
        assert r.status_code == 200
        data = r.json()
        assert data["identity_match"] is True
        assert data["deterministic_fields"]["weight"]["value"] == 3.0

    def test_huge_missing_fields_list_tolerated(self):
        r = client.post("/evidence/check", json=_payload(
            description="x" * 100,
            missing_fields=[f"field_{i}" for i in range(500)]))
        assert r.status_code == 200

    def test_null_like_strings_in_fields(self):
        # "None"/"null" strings must not explode identity or discovery
        r = client.post("/evidence/check", json=_payload(
            manufacturer="None", mpn="null", description="undefined"))
        assert r.status_code == 200


# ---------- Candidate robustness ----------

class TestCandidateRobustness:
    def test_duplicate_candidate_urls_bounded(self, monkeypatch):
        """The same URL repeated many times must not loop unboundedly."""
        calls = []

        def fake_discover(*a, **kw):
            return ([{"url": "https://dup-site.example.com/p"}] * 25, True)

        def fake_retrieve(url):
            calls.append(url)
            return {"content": "<p>MPN: DIFFERENT-1</p>",
                    "final_url": url, "status_code": 200}

        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        resp = client.post("/evidence/check", json=_payload(
            manufacturer="Acme", mpn="ABC123",
            description="industrial widget for testing purposes"))
        data = resp.json()
        assert len(calls) <= 3  # MAX_CANDIDATE_ATTEMPTS respected
        assert data["identity_match"] is False

    def test_malformed_and_blocked_candidates_skipped(self, monkeypatch):
        calls = []
        ok_page = {"content": "<p>Manufacturer: Acme</p><p>MPN: ABC123</p>"
                              "<p>UPC: 036000291452</p>",
                   "final_url": "", "status_code": 200}

        def fake_discover(*a, **kw):
            return ([
                {"url": "not a url at all"},
                {"url": "http://localhost:8080/admin"},
                {"url": "https://ok-shop.example.com/item"},
            ], True)

        def fake_retrieve(url):
            calls.append(url)
            return dict(ok_page, final_url=url)

        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        resp = client.post("/evidence/check", json=_payload(
            manufacturer="Acme", mpn="ABC123",
            description="industrial widget for testing purposes",
            missing_fields=["upc"]))
        data = resp.json()
        assert calls == ["https://ok-shop.example.com/item"]
        assert data["identity_match"] is True
        assert data["deterministic_fields"]["upc"]["value"] == "036000291452"

    def test_conflicting_sources_first_identity_match_wins(self, monkeypatch):
        """Two matching pages disagreeing on weight: service returns the first
        identity-matched candidate; downstream conflict handling owns merges."""
        pages = {
            "a": {"content": "<p>Manufacturer: Acme</p><p>MPN: ABC123</p>"
                             "<p>Weight: 3 kg</p>"},
            "b": {"content": "<p>Manufacturer: Acme</p><p>MPN: ABC123</p>"
                             "<p>Weight: 7 kg</p>"},
        }

        def fake_discover(*a, **kw):
            return ([{"url": "https://src-a.example.com/p"},
                     {"url": "https://src-b.example.com/p"}], True)

        def fake_retrieve(url):
            key = "a" if "src-a" in url else "b"
            return dict(pages[key], final_url=url, status_code=200)

        monkeypatch.setattr(evidence_app, "discover_sources", fake_discover)
        monkeypatch.setattr(evidence_app, "retrieve_url", fake_retrieve)

        data = client.post("/evidence/check", json=_payload(
            manufacturer="Acme", mpn="ABC123",
            description="industrial widget for testing purposes",
            missing_fields=["weight"])).json()
        assert data["identity_match"] is True
        assert data["deterministic_fields"]["weight"]["value"] == 3.0


# ---------- Security regression (Stage 4.1 intact) ----------

class TestSecurityRegression:
    def test_cloud_metadata_hosts_blocked(self):
        for host in ("metadata.google.internal", "169.254.169.254",
                     "100.100.100.200"):
            assert is_blocked_host(host) is True, host

    def test_ipv6_loopback_and_link_local_blocked(self):
        assert is_blocked_host("::1") is True
        assert is_blocked_host("fe80::1") is True
        assert is_blocked_host("[::1]") is True

    def test_redirect_target_validation(self):
        # fetch.py validates every redirect hop through validate_url;
        # a redirect to a private address must be rejected.
        ok, _ = validate_url("http://192.168.1.10/secret")
        assert ok is False
        ok, _ = validate_url("https://public.example.com/redir?to=http://127.0.0.1/")
        # The literal URL itself is public-safe; hop validation happens per-hop.
        assert ok is True

    def test_oversized_and_weird_schemes(self):
        ok, _ = validate_url("file:///etc/passwd")
        assert ok is False
        ok, _ = validate_url("gopher://example.com/x")
        assert ok is False
        ok, _ = validate_url("")
        assert ok is False

    def test_unknown_domain_never_promoted(self):
        st, tier = classify_source("https://totally-unknown-blog.example.net/post")
        assert st == "unknown" and tier == 4


# ---------- Identity normalization safety ----------

class TestIdentityNormalization:
    def test_mpn_meaningful_chars_preserved(self):
        assert normalize_mpn("ABC-123") == "ABC123"
        assert normalize_mpn("abc 123") == "ABC123"
        # Distinct alphanumerics are never dropped
        assert normalize_mpn("A1B2") != normalize_mpn("A1B20")

    def test_name_normalizer_unicode_safe(self):
        assert normalize_name("Müller") != ""
        assert normalize_name("") == ""
