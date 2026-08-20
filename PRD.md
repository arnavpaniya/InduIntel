# InduIntel — Product Requirements Document

## 1. Executive Summary

**InduIntel** is an AI-powered product intelligence enrichment pipeline for industrial/MRO (Maintenance, Repair, Operations) catalogs. It ingests raw product data (MPN, description, brand fields, manufacturer), runs a 5-step LLM enrichment pipeline, scores results against ground truth, and provides a dashboard for review and monitoring.

**Core Value Proposition**: Transform sparse industrial product records into structured, searchable, catalog-ready data with measurable accuracy — using Gemini 2.5 Flash with schema-enforced outputs and confidence calibration.

---

## 2. Problem Statement

Industrial distributors receive product data from multiple sources (E1, Unilog, DIB) with inconsistent quality:
- Manufacturer names polluted with distributor codes: `"Freud Inc (2435)"`
- Brand fields contain placeholders: `"-- Unbranded --"`, `"-- No DIB Brand --"`
- Descriptions lack standardized attributes, specs, UPC/GTIN, dimensions
- No systematic way to measure enrichment accuracy vs. ground truth

Manual normalization is slow, error-prone, and doesn't scale.

---

## 3. User Personas

| Persona | Goals | Pain Points |
|---------|-------|-------------|
| **Catalog Manager** | Upload CSV/PDF → get enriched data → export | Inconsistent source data; no confidence scoring |
| **Data Engineer** | Monitor pipeline health, quota, accuracy | Black-box LLM outputs; no observability |
| **QA Analyst** | Compare enriched output vs. ground truth | Manual spot-checking; no structured scoring |

---

## 4. Functional Requirements

### 4.1 Data Ingestion (FR-INGEST)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-INGEST-01 | Upload CSV with required columns: `Mfg_Part_Num`, `Part_Desc`, `E1_Brand`, `Unilog_Brand`, `DIB_Brand`, `Part_Manuf` | P0 |
| FR-INGEST-02 | Upload PDF — extract structured product data via regex parsing | P1 |
| FR-INGEST-03 | Manual single-item entry form | P1 |
| FR-INGEST-04 | Deduplicate by `mfg_part_num` (upsert) | P0 |
| FR-INGEST-05 | Clean placeholder values (`-- Unbranded --`, etc.) → `null` | P0 |
| FR-INGEST-06 | Assign `batch_id` (UUID) per upload for traceability | P0 |
| FR-INGEST-07 | Set initial status = `raw`, `is_ground_truth = false` | P0 |

### 4.2 Enrichment Pipeline (FR-ENRICH)

**Orchestrator** (`/api/enrich/run`) calls 5 steps sequentially per item:

| Step | Endpoint | Output Tables | Key Fields |
|------|----------|---------------|------------|
| 1. Manufacturer | `/api/enrich/manufacturer` | `items.manufacturer_name`, `items.brand_name` | Clean mfg name, infer brand |
| 2. Classify | `/api/enrich/classify` | `items.dept`, `items.class`, `items.fine`, `items.classpath` | Controlled taxonomy (Title Case, `>` delimited) |
| 3. Attributes | `/api/enrich/attributes` | `item_attributes` (label, value, uom) | Up to 50 structured attributes |
| 4. Descriptions | `/api/enrich/descriptions` | `item_descriptions` (5 variants) | `invoice_desc` (≤40), `mobile_desc` (60-80), `short_desc` (100-150), `long_desc1` (200-400), `marketing_description` (150-300) |
| 5. Specs | `/api/enrich/specs` | `item_specs` | UPC/EAN/GTIN/UNSPSC, dimensions, weight, price, country, warranty |

**Schema Enforcement**: Each step uses Gemini `responseSchema` (SchemaType.OBJECT) with `required: ['confidence', ...]` — structurally forcing numeric `confidence` (0.0–1.0) in every response.

**Caching**: Input hash (SHA-256 of input JSON) checked against `enrichment_logs` — cache hits re-apply stored output, skip LLM call.

**Confidence Computation** (orchestrator):
- `confidence_score` (0–100): % of expected fields filled across items, descriptions, attributes (≥5), specs
- `field_confidence` (0–1): mean of 5 step-level LLM self-reported confidences

**Status Determination**:
- `enriched`: has critical fields (manufacturer_name, brand_name, classpath) AND confidence_score ≥ 60
- `review`: missing critical OR confidence_score < 60
- `enriching`: in-progress
- `raw`: not yet processed

### 4.3 Batch Processing (FR-BATCH)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-BATCH-01 | Process up to N raw items (default 3) via `/api/enrich/batch` | P0 |
| FR-BATCH-02 | Daily quota guard: max 18 requests/day (Gemini free tier) tracked in `gemini_usage_log` | P0 |
| FR-BATCH-03 | Per-item quota check (5 requests/item) — skip if exceeded | P0 |
| FR-BATCH-04 | Return summary: processed, enriched, needs_review, avg_confidence, quota_used, skipped_due_to_quota | P0 |
| FR-BATCH-05 | 1s delay between items to avoid rate limits | P1 |

### 4.4 Scoring & Evaluation (FR-SCORE)

**Ground Truth Architecture**: Separate tables (`ground_truth_items`, `ground_truth_descriptions`, `ground_truth_attributes`, `ground_truth_specs`) — answer keys never mixed with enriched items.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SCORE-01 | Compare enriched item vs. ground truth by ID (`/api/score/item`) | P0 |
| FR-SCORE-02 | Field-level match types: `exact_match`, `close_match` (Levenshtein ≥85%), `mismatch`, `missing_in_output`, `extra_in_output` | P0 |
| FR-SCORE-03 | Group scores: identity, taxonomy, descriptions, attributes, specs | P0 |
| FR-SCORE-04 | Overall accuracy % = (exact + close) / total fields | P0 |
| FR-SCORE-05 | Confidence-accuracy correlation note (calibration diagnostic) | P1 |
| FR-SCORE-06 | Reason tags for low-accuracy groups: `input_too_sparse`, `requires_external_source`, `taxonomy_granularity_mismatch` | P1 |
| FR-SCORE-07 | Batch scoring endpoint (`/api/score/batch`) | P1 |
| FR-SCORE-08 | Self-comparison guard (reject item_id === ground_truth_id) | P0 |

### 4.5 Dashboard (FR-DASH)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DASH-01 | Paginated, sortable, filterable items table (status, search, batch filter) | P0 |
| FR-DASH-02 | Summary cards: Total, Raw, Enriched, Need Review | P0 |
| FR-DASH-03 | ConfidenceScore badge (0–100%, color-coded) | P0 |
| FR-DASH-04 | Per-item "Enrich" button (quota-aware) | P0 |
| FR-DASH-05 | "Run Batch (3)" button (quota-aware) | P0 |
| FR-DASH-06 | Upload modal (CSV / Manual / PDF tabs) | P0 |
| FR-DASH-07 | Post-upload redirect to `?batch=<batchId>` filter | P0 |
| FR-DASH-08 | Quota indicator (used/limit, near-limit warning) | P0 |
| FR-DASH-09 | Error toasts with status code + truncated response body | P0 |
| FR-DASH-10 | Detail page `/dashboard/[item_id]` with full enriched view | P1 |
| FR-DASH-11 | Insights page `/dashboard/insights` (accuracy charts, confidence calibration) | P1 |

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Single-item enrichment < 30s (5 sequential LLM calls); batch 3 items < 90s |
| **Reliability** | Retry on transient Gemini errors (429, network, timeout); max 1 retry |
| **Observability** | Structured debug logs per step; `enrichment_logs` table with input/output/duration |
| **Security** | Service-role key only in server routes; RLS on `items` table; no secrets in client bundle |
| **Quota Safety** | Hard daily limit (18); fail-open on quota check errors; near-limit UI warning |
| **Data Quality** | Schema-enforced LLM outputs; placeholder cleansing; fractional inch parsing (24-1/4 → 24.25) |

---

## 6. Data Model (Supabase/PostgreSQL)

### Core Tables

```sql
items (
  id UUID PK,
  mfg_part_num TEXT UNIQUE,
  part_desc TEXT,
  e1_brand TEXT,
  unilog_brand TEXT,
  dib_brand TEXT,
  part_manuf TEXT,
  manufacturer_name TEXT,
  brand_name TEXT,
  dept TEXT,
  class TEXT,
  fine TEXT,
  classpath TEXT,
  status TEXT CHECK IN ('raw','enriching','enriched','review'),
  confidence_score INT,        -- 0-100
  field_confidence NUMERIC,    -- 0-1 (mean of step confidences)
  is_ground_truth BOOLEAN DEFAULT false,
  batch_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

item_descriptions (item_id FK, field_name, value, char_count)
item_attributes (item_id FK, seq, label, value, uom)
item_specs (item_id FK, upc, ean, gtin, unspsc, list_price, length, width, height, weight, uoms, country_of_origin, warranty)

enrichment_logs (item_id, step, status, error, input_json, output_json, duration_ms, created_at)
gemini_usage_log (request_date DATE PK, request_count INT)
```

### Ground Truth Tables (Answer Keys)

```sql
ground_truth_items (id, mfg_part_num, manufacturer_name, brand_name, dept, class, fine, classpath, ...)
ground_truth_descriptions (item_id, field_name, value)
ground_truth_attributes (item_id, label, value, uom)
ground_truth_specs (item_id, upc, ean, gtin, unspsc, list_price, length, width, height, weight, uoms, country_of_origin, warranty)
```

---

## 7. API Contracts

### POST `/api/enrich/run`
```json
Request:  { "item_id": "uuid" }
Response: { "success": true, "item_id": "", "status": "enriched|review", "confidence_score": 85, "field_confidence": 0.82, "step_results": {...}, "item": EnrichedItem }
```

### POST `/api/enrich/batch`
```json
Request:  { "limit": 3 }
Response: { "success": true, "summary": { "processed": 2, "enriched": 1, "needs_review": 1, "avg_confidence": 72, "quota_used": 10, "quota_limit": 18, "skipped_due_to_quota": 1 }, "results": [...] }
```

### POST `/api/score/item`
```json
Request:  { "item_id": "uuid", "ground_truth_id": "uuid" }
Response: { "success": true, "overall_accuracy_pct": 78, "field_scores": [...], "group_scores": [...], "confidence_accuracy_correlation": {...} }
```

### POST `/api/items/upload`
- `multipart/form-data`: file + source (csv|pdf)
- `application/json`: manual entry fields
```json
Response: { "success": true, "message": "", "count": 5, "batchId": "uuid", "items": [{ "id": "", "mfg_part_num": "", "created_at": "" }] }
```

### GET `/api/items`
```json
Query: page, limit, status, search, batch
Response: { "items": Item[], "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 } }
```

---

## 8. Acceptance Criteria (Definition of Done)

| Feature | Criteria |
|---------|----------|
| CSV Upload | Valid CSV → items inserted with batch_id; redirect to dashboard filtered by batch |
| Enrichment Run | 5 steps execute; confidence_score + field_confidence computed; status set; logs written |
| Schema Enforcement | All 5 steps return `confidence` numeric (verified via unit test / manual run) |
| Batch Quota | 19th request in day returns 429; dashboard shows near-limit warning at ≥15 |
| Scoring | Ground truth comparison returns field/group scores + correlation note |
| Dashboard Errors | Failed fetch shows `Failed to load items (status 500) - {body}` not generic toast |
| TypeScript Build | `npm run build` passes with zero errors |

---

## 9. Future Enhancements (Out of Scope v1)

- Async job queue (BullMQ) for batch enrichment
- Human-in-the-loop review UI for `review` status items
- Export enriched data to CSV/JSON/Pimcore/Akun
- Multi-tenant / organization support
- Custom taxonomy import
- Prompt versioning & A/B testing
- Vector search for similar products

---

## 10. Glossary

| Term | Definition |
|------|------------|
| MPN | Manufacturer Part Number (primary key) |
| Ground Truth | Curated answer key in separate tables for scoring |
| field_confidence | Mean of 5 LLM self-reported confidences (0–1) |
| confidence_score | Coverage metric: % of expected fields populated (0–100) |
| classpath | Full taxonomy path: "Dept > Class > Fine > Subtype" |
| UOM | Unit of Measure (in, ft, mm, cm, lb, kg, V, A, W, dBA, RPM, psi) |
| UNSPSC | United Nations Standard Products and Services Code |