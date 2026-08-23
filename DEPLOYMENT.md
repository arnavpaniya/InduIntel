# Deployment & Operations Guide

Production and evaluation setup for the InduIntel UniHack pipeline.
**Never commit real keys.** All secrets live in `.env.local` (git-ignored).

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema in `supabase/` (SQL migrations) via the SQL editor or CLI.
3. From **Settings → API**, collect:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server-only secret**)

Required tables: `items`, `item_descriptions`, `item_attributes`,
`item_specs`, `item_assets`, `enrichment_logs`.

Verify anytime:

```bash
npx tsx scripts/supabase-production-check.ts
```

## 2. Gemini setup

1. Create an API key in Google AI Studio.
2. Set `GEMINI_API_KEY=...` and optionally `GEMINI_MODEL=gemini-2.5-flash`.

Budget behavior (verified by tests): deterministic evidence produces **0**
Gemini calls; ambiguous-but-evidenced fields trigger exactly **one batched**
call per product; failures leave fields unresolved without crashing.

## 3. Python evidence service

```bash
cd services/evidence
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Set `EVIDENCE_SERVICE_URL=http://127.0.0.1:8000`.

Built-in protections (do not weaken): SSRF host/IP blocklist, bounded
redirects, response-size limit, timeouts, identity verification before any
enrichment, regex-only deterministic extraction, no raw HTML ever sent to Gemini.

Smoke test: `POST $EVIDENCE_SERVICE_URL/evidence/check` with
`{"manufacturer":"X","mpn":"Y","description":"...","missing_fields":["upc"]}` —
must answer HTTP 200 with the contract keys (`success`, `needs_search`,
`identity_match`, `deterministic_fields`, `needs_gemini`, `unresolved`, …).

## 4. Search provider

The service needs a REAL search API — scraping search-engine HTML is not
supported by design. Configure any provider exposing:

```
GET $EVIDENCE_SEARCH_URL?q=<query>   ->  {"results":[{"url": "...", "title": "..."}]}
```

(e.g. a thin proxy around SerpAPI / Bing / Google Custom Search JSON API).
Set:

```
EVIDENCE_SEARCH_URL=https://your-provider.example/search
EVIDENCE_SEARCH_API_KEY=your_provider_key
```

Without it the pipeline runs honestly with external evidence unresolved and
reports `SEARCH PROVIDER NOT CONFIGURED`. **Do not fake one.**

## 5. Environment variables

Check presence (never prints values):

```bash
npx tsx scripts/check-production-env.ts
```

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | client + scripts |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | read path |
| `SUPABASE_URL` | recommended | server alias |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | writes, cache, export |
| `GEMINI_API_KEY` | yes | LLM steps |
| `GEMINI_MODEL` | optional | default `gemini-2.5-flash` |
| `EVIDENCE_SERVICE_URL` | yes | evidence microservice |
| `EVIDENCE_SEARCH_URL` | yes | search provider endpoint |
| `EVIDENCE_SEARCH_API_KEY` | yes | search provider auth |
| `INTERNAL_API_TOKEN` | optional | write-endpoint protection |

## 6. Local startup

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev                  # Next.js dashboard + API routes
cd services/evidence && python -m uvicorn app:app --port 8000
```

## 7. Production startup

```bash
npm run build && npm start
# evidence service behind your process manager of choice, e.g.:
# EVIDENCE_SERVICE_URL=http://127.0.0.1:8000
```

Run the one-command validation gate before shipping anything:

```bash
npm run validate:unihack
```

(tsc → lint → build → python compile+tests → output validator → env check;
non-zero exit if any mandatory variable is missing or any check fails.)

## 8. CSV upload

Dashboard upload or API:

```bash
curl -X POST -H "x-internal-api-token: $INTERNAL_API_TOKEN" \
     -F "file=@input.csv" http://localhost:3000/api/items/upload
```

Accepts ANY column order/naming via the input normalizer
(`Mfg_Part_Num`, `MPN`, `Part Number`, … all resolve). Rows without any
resolvable part number are skipped and reported, never fatal.

## 9. Enrichment process

Pipeline stages (frozen architecture):

```
normalize -> identity -> duplicates -> missing-field analysis ->
evidence service -> deterministic extraction -> Gemini (only if required,
one batched call) -> attributes/descriptions/specs -> CanonicalProduct
```

Every value carries a status: `verified | inferred | unresolved |
conflicting | invalid`. Fabricated values must always be zero.

## 10. Export

```bash
GET /api/export?format=csv     # or xlsx
```

Always emits exactly the organizer's 252 headers in exact order.

## 11. Output validation

```bash
npx tsx scripts/validate-unihack-output.ts reports/unihack-final-sample.csv
npx tsx scripts/validate-unihack-output.ts reports/unihack-final-sample.xlsx
```

Exit 0 = submission-valid. Regenerate both from the organizer sample with:

```bash
npx tsx scripts/run-unihack-pipeline.ts
```

## 12. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `401 Invalid API key` from Supabase | rotated/placeholder `SUPABASE_SERVICE_ROLE_KEY`; re-copy from dashboard |
| `SEARCH PROVIDER NOT CONFIGURED` | set `EVIDENCE_SEARCH_URL` + `EVIDENCE_SEARCH_API_KEY`; do not fake results |
| Everything unresolved after enrichment | evidence service down or search unconfigured; check `scripts/check-production-env.ts` and service logs |
| `identity_match=false` for many products | pages show different MPNs — correct rejection behavior; verify MPN quality in input |
| Gemini quota errors | pipeline degrades to unresolved; retry later; batched calls already minimize usage |
