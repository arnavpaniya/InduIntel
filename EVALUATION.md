# Evaluation Guide

How InduIntel behaves on the organizer's evaluation set and the exact
commands to verify before submission.

## Organizer input format

6 columns, any order/casing accepted by the normalizer:
`Mfg_Part_Num` · `Part_Desc` · `E1_Brand` · `Unilog_Brand` · `DIB_Brand` ·
`Part_Manuf`. Sentinels (`-- Unbranded --`, `-`) → null. Vendor codes in
`Part_Manuf` ("Name (CODE)") are stripped for manufacturer identity; raw value
is preserved on the output's `Part_Manuf`.

**Arbitrary schemas**: any superset/variant resolves via aliases (MPN,
Part Number, Manufacturer, MFR, SKU, UPC/EAN/GTIN, weights…). Ambiguous
headers (`Model`, `Part`, `Size`) stay unmapped rather than guessed.
Two source columns mapping to one field with different values ⇒ field is
marked `conflicting` and both values retained.

## Expected output requirements

Exactly **252 headers**, byte-identical to
`Unihack_ Expected Output - Delivery Format.csv` — spelling, capitalization,
order. No missing, no extra headers. Every data row has exactly 252 cells.

## 252-header contract enforcement

Frozen source: `lib/unihack/output-schema.ts` (import-time validation).
Independent validator: `scripts/validation/validate-unihack-output.ts`
(9 checks incl. RFC4180 re-parse and Unicode survival).

## Validation procedure

```bash
npm run validate:unihack        # 8-step gate, exit 0 = submission-ready
npx tsx scripts/production/run-unihack-pipeline.ts   # regenerate artifacts
npx tsx scripts/validation/validate-unihack-output.ts reports/unihack-final-sample.csv
npx tsx scripts/validation/validate-unihack-output.ts reports/unihack-final-sample.xlsx
```

## Dynamic-schema behavior

Unknown columns are reported (`unmappedColumns`) and ignored safely; rows
without any resolvable part number are skipped with counts — never fatal.
Duplicate input rows collapse to first occurrence.

## Evidence behavior

Missing-field analysis decides what merits lookup. Identity must be strong
(manufacturer+MPN) or medium (mfr+brand+description) before any network call.
Tavily returns candidate URLs; each hop is SSRF-validated; HTML sanitized;
identity re-verified on-page (wrong MPN ⇒ hard reject, next candidate, max 3).
Only regex-extracted facts become deterministic fields.

## Gemini behavior

Zero calls when deterministic extraction covers needs. Otherwise exactly ONE
batched call per product using only evidence lines (never raw page HTML).
Unsupported fields return null — live-model test proves no fabrication.
Daily quota tracked in `gemini_usage_log`; frontend reads `GET /api/usage`.

## Failure behavior

Dead search/evidence/Gemini, malformed rows, invalid URLs, rate limits:
per-product isolation — structured error, remaining dataset continues,
affected fields stay `unresolved` (never invented). Proven by unit tests
(`tests/unit/failure-recovery.test.ts`) and 500-product stability run.

## Cache behavior

Identity-keyed (manufacturer+MPN hash) — formatting variants share an entry;
different MPN/manufacturer can never collide. In-memory for batches;
persistent variant writes `enrichment_logs` rows (`step='external_evidence'`,
`input_json._identity_key`) requiring a service_role key and migration 010.

## Security behavior

SSRF blocklist + per-hop redirect validation + streamed size cap + timeouts;
no scraping of search engines; secrets only in `.env.local`; keys never logged
(verified by tests).

## Exact final-submission verification commands

```bash
npx tsc --noEmit && npm run lint && npm run build
python3 -m compileall -q services/evidence
python3 -m pytest services/evidence/tests -q
npx tsx tests/run-unit.ts
npx tsx scripts/production/run-unihack-pipeline.ts
npx tsx scripts/validation/validate-unihack-output.ts reports/unihack-final-sample.csv
npx tsx scripts/validation/validate-unihack-output.ts reports/unihack-final-sample.xlsx
npx tsx scripts/validation/check-production-env.ts
npx tsx scripts/validation/supabase-production-check.ts
npm run validate:unihack          # must exit 0
```

Acceptance: gate exit 0; `reports/unihack-final-validation.json` shows
`output_columns: 252`, `csv_valid/xlsx_valid: true`, `fabricated_values: 0`.
