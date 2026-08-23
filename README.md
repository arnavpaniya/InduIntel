# InduIntel — UniHack Product Intelligence Pipeline

Production-ready enrichment pipeline that transforms raw industrial product
feeds into catalog-ready records and exports them in the **exact UniHack
252-column delivery format**.

---

## 1. Project overview

InduIntel takes an arbitrary supplier CSV, understands its schema dynamically,
identifies each product, enriches it from authoritative external evidence
(with Gemini used only where genuinely necessary), tracks the provenance and
quality status of every value, and exports a submission-ready CSV/XLSX whose
headers are byte-identical to the organizer's contract.

## 2. UniHack problem statement

Given a raw distributor feed (`Mfg_Part_Num`, `Part_Desc`, three placeholder
brand columns, `Part_Manuf` with embedded vendor codes) produce a complete,
clean catalog record per product — taxonomy, descriptions, attributes,
specifications, identifiers — in a fixed 252-column schema.

## 3. What the system does

1. **Dynamic input normalization** — any column order/naming resolves through
   alias tables (`MPN`, `Part Number`, `Mfg_Part_Num`, … are one field);
   placeholders (`-- Unbranded --`) become null; conflicting source columns
   preserve both values as `conflicting`.
2. **Product identity** — `manufacturer + MPN` primary key (fallbacks defined),
   Unicode/case/separator-safe.
3. **Duplicate detection** — same identity ⇒ reuse enrichment, never re-query.
4. **Missing-field analysis** — deterministic decision on which fields justify
   external lookup.
5. **External evidence** — Python microservice discovers candidates via
   **Tavily**, retrieves them SSRF-safely, sanitizes HTML, **verifies identity**
   (wrong MPN ⇒ reject), extracts fields with pure regex.
6. **Gemini only when required** — at most ONE batched call per product, fed
   sanitized evidence lines only (never raw HTML); unsupported ⇒ null.
7. **Canonical model + provenance** — every field carries a status:
   `verified | inferred | unresolved | conflicting | invalid`.
8. **252-column export** — CSV/XLSX byte-stable headers, RFC4180 escaping.

## 4. Key guarantees

| Guarantee | Mechanism |
|---|---|
| Dynamic arbitrary input schemas | `lib/input/input-normalizer.ts` alias resolution + conflict preservation |
| No sample hardcoding | No organizer values in any pipeline code (verified by sweep) |
| No fabricated values | Status/provenance system; missing stays unresolved; live-model anti-fabrication test |
| Exact 252-column output | `lib/unihack/output-schema.ts` frozen contract + validator |

## 5–15. Architecture (see [ARCHITECTURE.md](./ARCHITECTURE.md))

Full diagrams, layer responsibilities, evidence service internals, Tavily
integration details, Gemini budget strategy, Supabase persistence, cache,
provenance storage, and export mechanics are documented there.

## 16. Local setup

```bash
git clone <repo> && cd InduIntel
npm install
cp .env.example .env.local        # fill real values (never commit)
cd services/evidence && pip install -r requirements.txt
```

## 17. Environment variables

Check presence (values never printed):

```bash
npx tsx scripts/validation/check-production-env.ts
```

See [.env.example](./.env.example) for the full list and
[DEPLOYMENT.md](./DEPLOYMENT.md) for setup walkthroughs.

## 18. Running frontend

```bash
npm run dev        # http://localhost:3000/dashboard
```

## 19. Running evidence service

```bash
cd services/evidence
python -m uvicorn app:app --port 8000
curl http://127.0.0.1:8000/       # -> {"search_provider":"TavilySearchProvider",...}
```

## 20. Running validation

```bash
npm run validate:unihack          # full gate (8 steps)
npm run test:unit                 # TypeScript suites
python -m pytest services/evidence/tests -q
```

## 21. Running organizer sample

```bash
npx tsx scripts/production/run-unihack-pipeline.ts
# -> reports/unihack-final-sample.csv/.xlsx + validation/audit JSONs
npx tsx scripts/inspection  # see scripts/validation/inspect-organizer-files.ts
```

## 22. Output validation

```bash
npx tsx scripts/validation/validate-unihack-output.ts reports/unihack-final-sample.csv
npx tsx scripts/validation/validate-unihack-output.ts reports/unihack-final-sample.xlsx
```

Exit 0 = submission-valid (9 checks: header count/order/equality, row widths,
RFC4180, Unicode, static headers unchanged).

## 23. Security model

- SSRF blocklist (loopback/private/link-local/metadata IPs), per-hop redirect
  validation, streamed response-size cap, bounded timeouts/retries.
- Identity verification gates ALL external enrichment.
- Raw HTML never reaches Gemini.
- Secrets live only in `.env.local` (git-ignored); `.env.example` has
  placeholders; keys never logged.

## 24. Gemini budget strategy

- Deterministic evidence ⇒ **zero** calls (counted as avoided).
- Ambiguous-but-evidenced ⇒ exactly **one batched** call per product.
- Daily quota via `gemini_usage_log` + `DAILY_QUOTA_LIMIT`; frontend reads
  real usage from `GET /api/usage`.

## 25. Troubleshooting

| Symptom | Fix |
|---|---|
| `401 Invalid API key` (Supabase) | rotate service-role key |
| `SEARCH PROVIDER NOT CONFIGURED` | set Tavily env vars (DEPLOYMENT.md §4) |
| Cache writes warn `step_check` | apply `supabase/migrations/010_external_evidence_step.sql` |
| Everything unresolved | evidence service down / no search key |

## 26. Final evaluation checklist

1. `npm run validate:unihack` → exit 0
2. `reports/unihack-final-validation.json`: `fabricated_values: 0`,
   `output_columns: 252`, `csv_valid: true`, `xlsx_valid: true`
3. Both output files pass the validator
4. Evidence service reports Tavily provider
5. Persistent cache round trip PASS (`scripts/validation/supabase-production-check.ts`)
