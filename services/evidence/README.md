# Evidence Service (Stage 4)

Deterministic product-evidence microservice. Performs source discovery,
SSRF-safe retrieval, HTML sanitization, identity verification, and
deterministic field extraction BEFORE any Gemini call.

## Run

    pip install -r requirements.txt
    uvicorn app:app --host 0.0.0.0 --port 8000

## API

POST /evidence/check

    {
      "manufacturer": "Acme",
      "brand": "AcmeBrand",
      "mpn": "ABC123",
      "description": "...",
      "category": "electronics",
      "missing_fields": ["upc", "weight", "warranty"]
    }

Response distinguishes `deterministic_fields`, `needs_gemini`, and
`unresolved`. The Node pipeline must only invoke Gemini for
`needs_gemini` items, in ONE batched request.

## Configuration (env vars)

- EVIDENCE_SEARCH_URL / EVIDENCE_SEARCH_API_KEY — optional search provider.
  When unset, discovery returns `needs_search=false` style empty results;
  the service never scrapes search-engine HTML.
- EVIDENCE_MAX_REDIRECTS (5), EVIDENCE_MAX_RESPONSE_SIZE (1MB),
  EVIDENCE_REQUEST_TIMEOUT (10s)

## Security

- HTTP/HTTPS only; localhost, loopback, private ranges, link-local, and
  cloud-metadata endpoints blocked (`security.py`)
- Every redirect hop re-validated; max 5 hops; max 1MB body
- Retrieved pages are untrusted DATA: scripts/styles/nav/forms stripped,
  prompt-injection text never executed or followed (`sanitize.py`)
- No secrets are ever sent to retrieved pages or included in prompts

## Tests

    python -m pytest services/evidence/tests
