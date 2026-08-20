# InduIntel — Architecture Document

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            INDUINTEL ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐     ┌──────────────────┐     ┌────────────────────────────┐  │
│  │  Client  │────▶│   Next.js 14     │────▶│      Supabase (Postgres)    │  │
│  │ (React)  │     │  (App Router)    │     │  ┌──────────────────────┐  │  │
│  └──────────┘     └────────┬─────────┘     │  │  Tables              │  │  │
│                            │               │  │  • items             │  │  │
│         ┌──────────────────┼──────────────┘  │  • item_descriptions │  │  │
│         │                  │                 │  • item_attributes   │  │  │
│         ▼                  ▼                 │  • item_specs        │  │  │
│  ┌─────────────────────────────────┐         │  • enrichment_logs   │  │  │
│  │      API Routes (Server)        │         │  • gemini_usage_log  │  │  │
│  │  ┌───────────────────────────┐  │         │  • ground_truth_*    │  │  │
│  │  │ /api/items/*              │  │         │  └──────────────────────┘  │  │
│  │  │ /api/enrich/*             │  │         └────────────────────────────┘  │
│  │  │ /api/score/*              │  │                    │                   │
│  │  └───────────────────────────┘  │                    │                   │
│  └─────────────────────────────────┘                    │                   │
│          │          │          │                       │                   │
│          ▼          ▼          ▼                       ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    LIB LAYER (Shared Modules)                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │  gemini  │ │ scoring  │ │ supabase │ │   api    │ │  debug   │  │  │
│  │  │  client  │ │ compare  │ │ clients  │ │ client   │ │  utils   │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    EXTERNAL SERVICES                                 │  │
│  │  ┌──────────────────┐                                               │  │
│  │  │ Google Gemini    │  (gemini-2.5-flash, responseSchema enforced)  │  │
│  │  │ Generative AI    │                                               │  │
│  │  └──────────────────┘                                               │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js | 14.2 (App Router) | React framework, server components, API routes |
| **Language** | TypeScript | 5.9 | Type safety across stack |
| **Database** | Supabase / PostgreSQL | 2.x / 15+ | Auth, DB, Realtime, RLS |
| **LLM** | Google Generative AI | 0.24 | Gemini 2.5 Flash with JSON schema |
| **Styling** | Tailwind CSS | 3.4 | Utility-first CSS |
| **UI Components** | shadcn/ui + Radix | Latest | Accessible component primitives |
| **Animation** | Motion (Framer Motion) | 13.1 | Transitions, gestures |
| **Charts** | Recharts | 3.10 | Insights visualizations |
| **CSV Parsing** | csv-parse | 7.0 | RFC 4180 compliant |
| **PDF Parsing** | pdf-parse | 2.4 | Text extraction |
| **Validation** | Zod (via schema) | — | Gemini responseSchema enforcement |

---

## 3. Module Architecture

### 3.1 Directory Structure

```
InduIntel/
├── app/
│   ├── api/
│   │   ├── items/           # CRUD + upload
│   │   │   ├── route.ts     # GET (list), POST (upload)
│   │   │   ├── [id]/route.ts
│   │   │   └── upload/route.ts
│   │   ├── enrich/
│   │   │   ├── run/route.ts          # Orchestrator (5 steps)
│   │   │   ├── batch/route.ts        # Quota-aware batch
│   │   │   ├── manufacturer/route.ts # Step 1
│   │   │   ├── classify/route.ts     # Step 2
│   │   │   ├── attributes/route.ts   # Step 3
│   │   │   ├── descriptions/route.ts # Step 4
│   │   │   └── specs/route.ts        # Step 5
│   │   └── score/
│   │       ├── item/route.ts
│   │       └── batch/route.ts
│   ├── dashboard/
│   │   ├── page.tsx              # Main dashboard (client)
│   │   ├── [item_id]/page.tsx    # Item detail
│   │   └── insights/page.tsx     # Analytics
│   └── layout.tsx, page.tsx
├── lib/
│   ├── ai/
│   │   ├── gemini.ts             # callLLM, callLLMWithRetry, schemas
│   │   └── attributes.ts         # parseMeasurement, formatMeasurement
│   ├── scoring/
│   │   ├── compare.ts            # Core scoring logic
│   │   └── batch.ts              # Batch scoring orchestrator
│   ├── supabase/
│   │   ├── server.ts             # SSR client (cookies)
│   │   └── admin.ts              # Service-role client
│   ├── api.ts                    # Client-side fetch wrappers
│   ├── types.ts                  # All TypeScript interfaces
│   ├── utils.ts                  # cn(), helpers
│   └── debug.ts                  # Structured logging
├── components/ui/                # shadcn/ui components
├── scripts/                      # Dev/ops scripts (seed, migrate, etc.)
└── middleware.ts                 # Auth session refresh
```

### 3.2 Key Module Responsibilities

#### `lib/ai/gemini.ts` — LLM Client
- **`callLLM(prompt, options)`**: Single request with `responseSchema` support
- **`callLLMWithRetry(prompt, options, maxRetries=1)`**: Retries on 429/network/timeout
- **Schema enforcement**: All 5 enrichment steps pass `Schema` with `required: ['confidence', ...]`
- **Model**: `gemini-2.5-flash` (configurable via `GEMINI_MODEL` env, fallback in code)
- **Output**: `{ data: T, raw: string, error: string }`

#### `lib/ai/attributes.ts` — Measurement Normalization
- **`parseMeasurement("24-1/4 in")`** → `{ value: 24.25, uom: "in" }`
- **`formatMeasurement(value, uom)`** → standardized string
- Handles fractional inches, decimal conversion, UOM standardization

#### `lib/scoring/compare.ts` — Ground Truth Scoring
- **`scoreItem(enrichedId, gtId)`** → `ScoreResult`
- Field comparators: string (Levenshtein ≥85% = close_match), numeric (≤5% rel diff = close_match)
- Group scoring: identity, taxonomy, descriptions, attributes, specs
- **Confidence-accuracy correlation**: 4-quadrant calibration diagnostic
- **Reason tags**: `input_too_sparse`, `requires_external_source`, `taxonomy_granularity_mismatch`

#### `lib/supabase/server.ts` & `admin.ts`
- **Server client**: `@supabase/ssr` with cookie-based auth (RLS enabled)
- **Admin client**: Service-role key for writes bypassing RLS (orchestrator, batch, scoring)

#### `lib/api.ts` — Client Fetch Layer
- **`fetchJson<T>(url, options)`**: Throws enriched `Error` with `.status` and `.body`
- All dashboard API calls route through this for consistent error handling

#### `lib/debug.ts` — Observability
- `debugLog`, `debugError`, `debugJson`, `debugWarn` — conditional on `DEBUG=true`
- Structured objects for step timing, input/output, SQL results

---

## 4. Data Flow

### 4.1 Upload → Enrich → Score

```
CSV/PDF/Manual
      │
      ▼
POST /api/items/upload
      │
      ▼
items table (status=raw, batch_id=UUID)
      │
      ▼
User clicks "Enrich" or "Run Batch"
      │
      ▼
POST /api/enrich/run (per item)          POST /api/enrich/batch (quota-aware)
      │                                          │
      ▼                                          ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐
│ Orchestrator (run/route.ts) │        │ Batch loop: check quota →   │
│                             │        │ call /api/enrich/run/item   │
│ 1. manufacturer             │        │                             │
│ 2. classify                 │        │                             │
│ 3. attributes               │        │                             │
│ 4. descriptions             │        │                             │
│ 5. specs                    │        │                             │
│                             │        │                             │
│ Compute confidence_score    │        │                             │
│ Compute field_confidence    │        │                             │
│ Determine status            │        │                             │
│ Update items row            │        │                             │
└─────────────────────────────┘        └─────────────────────────────┘
      │                                          │
      ▼                                          ▼
enrichment_logs (per step)              enrichment_logs (batch summary)
      │
      ▼
User clicks "Score" (if ground truth exists)
      │
      ▼
POST /api/score/item
      │
      ▼
lib/scoring/compare.ts
      │
      ▼
Field scores + Group scores + Correlation note
```

### 4.2 Enrichment Step Detail (each step)

```
POST /api/enrich/{step}
      │
      ▼
1. Fetch item + required input fields
2. Hash input (SHA-256) → check enrichment_logs cache
3. If cache hit: re-apply output, return cached
4. Build prompt (system + user data)
5. callLLMWithRetry(prompt, { schema: STEP_SCHEMA, temperature })
6. Parse JSON → validate required fields present
7. Write to target table(s)
8. Log to enrichment_logs (success/error, duration)
9. Return { success, data: { confidence, ... } }
```

---

## 5. Database Schema

### 5.1 Core Tables

```sql
-- Main items table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mfg_part_num TEXT UNIQUE NOT NULL,
  part_desc TEXT,
  e1_brand TEXT,
  unilog_brand TEXT,
  dib_brand TEXT,
  part_manuf TEXT,
  
  -- Enriched fields
  manufacturer_name TEXT,
  brand_name TEXT,
  dept TEXT,
  class TEXT,
  fine TEXT,
  classpath TEXT,
  
  status TEXT CHECK (status IN ('raw','enriching','enriched','review')) DEFAULT 'raw',
  confidence_score INT DEFAULT 0,          -- 0-100 coverage
  field_confidence NUMERIC DEFAULT 0,      -- 0-1 mean LLM confidence
  is_ground_truth BOOLEAN DEFAULT FALSE,
  batch_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5 description variants per item
CREATE TABLE item_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,  -- invoice_desc, mobile_desc, short_desc, long_desc1, marketing_description
  value TEXT NOT NULL,
  char_count INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Structured attributes (label, value, uom)
CREATE TABLE item_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  seq INT NOT NULL,
  label TEXT,
  value TEXT,
  uom TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Product specifications
CREATE TABLE item_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  upc TEXT, ean TEXT, gtin TEXT, unspsc TEXT,
  list_price NUMERIC,
  length NUMERIC, length_uom TEXT,
  width NUMERIC, width_uom TEXT,
  height NUMERIC, height_uom TEXT,
  weight NUMERIC, weight_uom TEXT,
  country_of_origin TEXT,
  warranty TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log for every enrichment step
CREATE TABLE enrichment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  step TEXT NOT NULL,  -- manufacturer, classify, attributes, descriptions, specs, orchestrator, batch
  status TEXT CHECK (status IN ('success','error')),
  error TEXT,
  input_json JSONB,
  output_json JSONB,
  duration_ms INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Daily Gemini quota tracking
CREATE TABLE gemini_usage_log (
  request_date DATE PRIMARY KEY,
  request_count INT DEFAULT 0
);

-- Ground truth (answer keys) — separate from items
CREATE TABLE ground_truth_items (...);
CREATE TABLE ground_truth_descriptions (...);
CREATE TABLE ground_truth_attributes (...);
CREATE TABLE ground_truth_specs (...);
```

### 5.2 Indexes

```sql
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_batch_id ON items(batch_id);
CREATE INDEX idx_items_mfg_part_num ON items(mfg_part_num);
CREATE INDEX idx_enrichment_logs_item_step ON enrichment_logs(item_id, step);
CREATE INDEX idx_item_attributes_item_id ON item_attributes(item_id);
CREATE INDEX idx_item_descriptions_item_id ON item_descriptions(item_id);
CREATE INDEX idx_item_specs_item_id ON item_specs(item_id);
```

### 5.3 Row Level Security

```sql
-- Items: authenticated users can read all, only service role writes
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_items" ON items FOR SELECT USING (auth.role() = 'authenticated');
-- Service role bypasses RLS via admin client

-- Enrichment logs: service role only
ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON enrichment_logs FOR ALL USING (auth.role() = 'service_role');
```

---

## 6. API Design

### 6.1 REST Conventions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/items` | Paginated list with filters |
| GET | `/api/items/:id` | Full enriched item with relations |
| POST | `/api/items/upload` | CSV/PDF/manual upload |
| POST | `/api/enrich/run` | Single-item orchestration |
| POST | `/api/enrich/batch` | Quota-aware batch |
| POST | `/api/enrich/manufacturer` | Step 1 |
| POST | `/api/enrich/classify` | Step 2 |
| POST | `/api/enrich/attributes` | Step 3 |
| POST | `/api/enrich/descriptions` | Step 4 |
| POST | `/api/enrich/specs` | Step 5 |
| POST | `/api/score/item` | Compare enriched vs ground truth |
| POST | `/api/score/batch` | Batch scoring |

### 6.2 Error Format

```json
{ "error": "Human-readable message", "details?: any" }
```
HTTP status: 400 (validation), 404 (not found), 429 (quota), 500 (server)

### 6.3 Client-Side Error Handling

`lib/api.ts:fetchJson` throws enriched `Error`:
```typescript
const error = new Error(message) as Error & { status: number; body: string };
error.status = response.status;
error.body = errorBody;
throw error;
```
Dashboard catches and displays: `Failed to load items (status 500) - {truncated_body}`

---

## 7. LLM Integration Details

### 7.1 Model Configuration

```typescript
// lib/ai/gemini.ts
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Generation config per call
{
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a precise data extraction assistant. Output only valid JSON.',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.1,  // Low for deterministic extraction
    responseSchema: STEP_SCHEMA  // SchemaType.OBJECT with required fields
  }
}
```

### 7.2 Schema Definitions (All 5 Steps)

Each step defines a `Schema` constant with `required: ['confidence', ...]`:

| Step | Required Fields | Notes |
|------|-----------------|-------|
| Manufacturer | `manufacturer_name`, `brand_name`, `confidence`, `reasoning` | Nullable strings for names |
| Classify | `dept`, `class`, `fine`, `classpath`, `confidence`, `reasoning` | All nullable strings |
| Attributes | `attributes[]`, `confidence`, `reasoning` | Array items require `label`, `value`, `uom` |
| Descriptions | `descriptions[]`, `confidence`, `reasoning` | Array items require `field_name`, `value`, `char_count` |
| Specs | All 14 spec fields + `confidence`, `reasoning` | All nullable, numeric where appropriate |

### 7.3 Prompt Engineering Pattern

```
SYSTEM: "You are a precise data extraction assistant. Output only valid JSON."

USER: 
{STEP_PROMPT}

Item data:
- field1: {value}
- field2: {value}
...

Return JSON only.
```

### 7.4 Caching Strategy

- **Key**: SHA-256 of input JSON (first 16 chars) stored in `enrichment_logs.input_json._hash`
- **Lookup**: `step` + `item_id` + `input_hash` + `status=success` → latest
- **Cache hit**: Re-apply output to tables, log new `enrichment_logs` entry, return cached
- **Cache miss**: Call LLM, log success, return fresh

### 7.5 Retry Logic

```typescript
// Transient errors: 429, network, timeout, ECONNREFUSED
// Max 1 retry with 3s backoff
// On parse failure: retry with stricter "output ONLY valid JSON" prompt
```

---

## 8. Quota Management

### 8.1 Limits
- **Gemini Free Tier**: 15 RPM, 1,500 RPD
- **Safety Margin**: `DAILY_QUOTA_LIMIT = 18` requests/day (5 per item × 3 items = 15, buffer = 3)
- **Batch Default**: 3 items (15 requests)

### 8.2 Implementation (`app/api/enrich/batch/route.ts`)

```typescript
async function checkAndIncrementQuota(supabase) {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('gemini_usage_log')
    .select('request_count')
    .eq('request_date', today)
    .maybeSingle();
  
  const currentCount = existing?.request_count || 0;
  if (currentCount >= DAILY_QUOTA_LIMIT) return { allowed: false, currentCount };
  
  await supabase.from('gemini_usage_log').upsert(
    { request_date: today, request_count: currentCount + 1 },
    { onConflict: 'request_date' }
  );
  return { allowed: true, currentCount: currentCount + 1 };
}
```

- **Per-item check**: Before each of 5 step calls
- **Fail-open**: If quota check errors, allow (log warning)
- **Dashboard**: Shows `used/limit`, warns at `near_limit` (≥15)

---

## 9. Confidence & Scoring System

### 9.1 Two Confidence Metrics

| Metric | Range | Source | Purpose |
|--------|-------|--------|---------|
| `confidence_score` | 0–100 | Orchestrator coverage calc | UI "Fields Filled" % |
| `field_confidence` | 0–1 | Mean of 5 step `confidence` | LLM self-assessment calibration |

**Coverage Formula** (`app/api/enrich/run/route.ts:139-179`):
```typescript
requiredFields = [
  { table: 'items', fields: ['manufacturer_name','brand_name','dept','class','fine','classpath'] },
  { table: 'item_descriptions', fields: ['invoice_desc','mobile_desc','short_desc','long_desc1'] },
  { table: 'item_attributes', minCount: 5 },
  { table: 'item_specs', fields: ['upc','length','width','height','weight','warranty'] }
];

confidenceScore = round((filled / expected) * 100);
```

### 9.2 Status Determination

```typescript
function determineStatus(confidenceScore, item) {
  const hasCritical = ['manufacturer_name','brand_name','classpath'].every(f => item[f]);
  if (!hasCritical) return 'review';
  if (confidenceScore < 60) return 'review';
  return 'enriched';
}
```

### 9.3 Scoring Correlation (Calibration)

```typescript
// lib/scoring/compare.ts:computeConfidenceCorrelation
if (confidenceScore < 60 && accuracyPct < 50) 
  → "Low confidence correctly flags low accuracy — review triggered appropriately"
else if (confidenceScore >= 80 && accuracyPct >= 80)
  → "High confidence aligns with high accuracy — auto-enrichment reliable"
else if (confidenceScore < 60 && accuracyPct >= 70)
  → "Conservative confidence — item flagged for review despite decent accuracy"
else if (confidenceScore >= 80 && accuracyPct < 50)
  → "Overconfident — confidence score overestimates actual accuracy (investigate)"
else
  → "Moderate confidence/accuracy alignment"
```

---

## 10. Security

| Layer | Measure |
|-------|---------|
| **Auth** | Supabase Auth (email/password, magic link) via `@supabase/ssr` |
| **RLS** | Enabled on all tables; policies restrict to authenticated users |
| **Service Role** | Only in server routes (`supabaseAdmin`); never in client bundle |
| **API Keys** | `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` only |
| **Input Validation** | CSV column validation; MPN required; placeholder cleansing |
| **Self-Comparison Guard** | `/api/score/item` rejects `item_id === ground_truth_id` |

---

## 11. Observability & Debugging

### 11.1 Structured Logging

```typescript
// lib/debug.ts
export function debugLog(...args) { if (process.env.DEBUG) console.log('[LOG]', ...args); }
export function debugError(...args) { if (process.env.DEBUG) console.error('[ERROR]', ...args); }
export function debugJson(label, obj) { if (process.env.DEBUG) console.log(label, JSON.stringify(obj, null, 2)); }
```

### 11.2 Key Log Points

| Location | Logs |
|----------|------|
| Orchestrator | Step start/end, duration, confidence, status decision |
| Enrichment Steps | Cache hit/miss, input hash, LLM raw response, parse result, DB write |
| Batch | Quota check, items fetched, per-item result, summary |
| Scoring | Field comparisons, group scores, correlation note |
| Dashboard | Fetch errors with status/body, upload progress |

### 11.3 Enrichment Logs Table

Every step writes to `enrichment_logs`:
```json
{
  "item_id": "uuid",
  "step": "manufacturer",
  "status": "success",
  "error": null,
  "input_json": { "mfg_part_num": "...", "_hash": "abc123" },
  "output_json": { "manufacturer_name": "...", "confidence": 0.92, "reasoning": "..." },
  "duration_ms": 1450
}
```

---

## 12. Deployment

### 12.1 Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=

# Optional
GEMINI_MODEL=gemini-2.5-flash
DAILY_QUOTA_LIMIT=18
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEBUG=true
```

### 12.2 Build & Run

```bash
npm install
npm run build    # TypeScript + Next.js compilation
npm run dev      # Development server
npm run start    # Production server
```

### 12.3 Scripts

| Script | Purpose |
|--------|---------|
| `npm run seed` | Load sample CSV into `items` |
| `scripts/enrich_gt.ts` | Enrich ground truth items |
| `scripts/score_batch.ts` | Run batch scoring |
| `scripts/fix_confidence_scale.ts` | Migration for field_confidence 0-1 → 0-100 |

---

## 13. Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Sequential LLM calls (5/item) | Low temperature (0.1), short prompts, 1 retry max |
| Dashboard N+1 queries | Single `fetchItems` with `select(*, relations)` |
| Quota exhaustion | Daily limit 18, batch default 3, per-item check |
| Large CSV uploads | Streaming parse, batch upsert, deduplicate by MPN |
| PDF parsing | `pdf-parse` on buffer, regex extraction (no OCR) |

---

## 14. Testing Strategy

| Type | Coverage |
|------|----------|
| **TypeScript** | `npx tsc --noEmit` — strict mode, zero errors |
| **Build** | `npm run build` — Next.js compilation + lint |
| **Manual** | Upload CSV → enrich → score → verify dashboard |
| **Schema Validation** | All 5 steps return `confidence` numeric (enforced by Gemini schema) |
| **Error Paths** | Quota exceeded, invalid CSV, missing item, self-comparison |

---

## 15. Future Architecture Evolution

| Area | Planned Improvement |
|------|---------------------|
| **Async Processing** | Move batch enrichment to BullMQ/Redis queue |
| **Prompt Management** | Versioned prompts in DB with A/B testing |
| **Multi-tenancy** | Organization-scoped RLS, separate ground truth per org |
| **Vector Search** | `pgvector` for similar product lookup |
| **Export** | CSV/JSON/Pimcore/Akun connectors |
| **Monitoring** | OpenTelemetry traces, Sentry error tracking |