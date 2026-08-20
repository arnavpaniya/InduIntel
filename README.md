# InduIntel — AI Product Intelligence Enrichment Pipeline

Transform messy industrial/MRO catalog data into clean, structured, commerce-ready product records using AI. InduIntel automates a 5-step enrichment pipeline with schema-enforced LLM outputs, ground-truth validation, and calibrated confidence scoring at every stage.

**Live Demo**: [Dashboard](http://localhost:3000/dashboard) | [Insights](http://localhost:3000/dashboard/insights)

---

## Highlights

- **5-Step Pipeline**: Manufacturer → Classification → Attributes → Descriptions → Specs
- **Schema-Enforced Outputs**: Gemini `responseSchema` forces structured JSON with required `confidence` field
- **Ground-Truth Scoring**: Separate answer-key tables, field-level match types, group accuracy, confidence calibration
- **Quota-Aware Batching**: Daily limit guard (18 req/day free tier), per-item check, dashboard indicator
- **Observability**: Structured logs, `enrichment_logs` audit table, error toasts with status/body
- **Type-Safe**: Strict TypeScript, zero build errors, shared types across client/server

---

## Quick Start

```bash
# 1. Clone & install
git clone <repo-url>
cd InduIntel
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - GEMINI_API_KEY
# - GEMINI_MODEL=gemini-2.5-flash  (updated from 2.0-flash)

# 3. Set up database
# Run migrations in Supabase Dashboard → SQL Editor, or via CLI:
# supabase db push

# 4. Seed sample data (optional)
npm run seed

# 5. Start dev server
npm run dev
```

Open:
- **Landing**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **Insights**: http://localhost:3000/dashboard/insights

---

## Core Workflow

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐     ┌──────────────┐
│   Upload    │────▶│  5-Step Enrichment   │────▶│   Review    │────▶│    Score     │
│  CSV/PDF/   │     │  (Manufacturer,      │     │  Dashboard  │     │  vs Ground   │
│  Manual     │     │   Classify, Attrs,   │     │  (status,   │     │   Truth      │
└─────────────┘     │   Descriptions,      │     │  confidence)│     │  (accuracy,  │
                    │   Specs)             │     └─────────────┘     │  calibration)│
                    └──────────────────────┘                         └──────────────┘
```

### 1. Upload Data
- **CSV**: Required columns — `Mfg_Part_Num`, `Part_Desc`, `E1_Brand`, `Unilog_Brand`, `DIB_Brand`, `Part_Manuf`
- **PDF**: Regex extraction of same fields
- **Manual**: Single-item form
- Deduplicates by `mfg_part_num` (upsert), cleans placeholders (`-- Unbranded --` → `null`), assigns `batch_id`

### 2. Enrich (5 Steps)
| Step | Endpoint | Output | Key Fields |
|------|----------|--------|------------|
| 1. Manufacturer | `/api/enrich/manufacturer` | `items` | `manufacturer_name`, `brand_name` |
| 2. Classify | `/api/enrich/classify` | `items` | `dept`, `class`, `fine`, `classpath` |
| 3. Attributes | `/api/enrich/attributes` | `item_attributes` | `label`, `value`, `uom` (×50 max) |
| 4. Descriptions | `/api/enrich/descriptions` | `item_descriptions` | 5 variants with char limits |
| 5. Specs | `/api/enrich/specs` | `item_specs` | UPC/EAN/GTIN, dims, weight, price, warranty |

Each step:
1. Hashes input → checks `enrichment_logs` cache
2. Calls Gemini with `responseSchema` (required `confidence`)
3. Writes to target table(s)
4. Logs input/output/duration

### 3. Orchestrate & Score
- **Single**: `POST /api/enrich/run` → runs all 5 steps, computes `confidence_score` (coverage 0-100) + `field_confidence` (mean LLM confidence 0-1), sets status (`enriched`/`review`)
- **Batch**: `POST /api/enrich/batch` → quota-aware, processes up to 3 raw items
- **Score**: `POST /api/score/item` → compares enriched vs ground truth, returns field/group scores + calibration note

---

## Dashboard Features

| Feature | Description |
|---------|-------------|
| **Items Table** | Paginated, sortable, filterable (status, search, batch filter) |
| **Summary Cards** | Total, Raw, Enriched, Need Review counts |
| **Confidence Badge** | Color-coded: ≥80% green, 60-79% amber, <60% red |
| **Per-Item Enrich** | Quota-aware button, shows status in tooltip |
| **Batch Enrich** | Runs 3 items, respects daily quota |
| **Upload Modal** | CSV / Manual / PDF tabs, post-upload redirect to `?batch=<id>` |
| **Quota Indicator** | Shows used/limit, warns at ≥15/18 |
| **Error Toasts** | Detailed: `Failed to load items (status 500) - {body}` |
| **Item Detail** | `/dashboard/[id]` — full enriched view with all relations |
| **Insights** | `/dashboard/insights` — accuracy charts, confidence correlation |

---

## Architecture

```
Next.js 14 (App Router) + TypeScript
├── app/
│   ├── api/
│   │   ├── items/              # GET list, GET [id], POST upload
│   │   ├── enrich/
│   │   │   ├── run/            # Orchestrator (5 steps)
│   │   │   ├── batch/          # Quota-aware batch
│   │   │   ├── manufacturer/   # Step 1
│   │   │   ├── classify/       # Step 2
│   │   │   ├── attributes/     # Step 3
│   │   │   ├── descriptions/   # Step 4
│   │   │   └── specs/          # Step 5
│   │   └── score/              # Ground-truth validation
│   └── dashboard/              # Client components (React)
├── lib/
│   ├── ai/
│   │   ├── gemini.ts           # callLLM, callLLMWithRetry, schemas
│   │   └── attributes.ts       # Measurement parsing (24-1/4 → 24.25)
│   ├── scoring/compare.ts      # Levenshtein, numeric diff, group scoring
│   ├── supabase/               # SSR (cookies) + Admin (service role)
│   ├── api.ts                  # Client fetch with enriched errors
│   ├── types.ts                # All interfaces
│   └── debug.ts                # Structured logging
└── components/ui/              # shadcn/ui + Radix primitives
```

**External**: Google Gemini 2.5 Flash (`responseSchema` enforced), Supabase/PostgreSQL

---

## Data Model (Key Tables)

```sql
items (id, mfg_part_num, part_desc, e1_brand, unilog_brand, dib_brand, part_manuf,
       manufacturer_name, brand_name, dept, class, fine, classpath,
       status, confidence_score, field_confidence, is_ground_truth, batch_id)

item_descriptions (item_id, field_name, value, char_count)      -- 5 variants
item_attributes (item_id, seq, label, value, uom)               -- structured attrs
item_specs (item_id, upc, ean, gtin, unspsc, list_price,
            length, width, height, weight, uoms, country, warranty)

enrichment_logs (item_id, step, status, error, input_json, output_json, duration_ms)
gemini_usage_log (request_date, request_count)                  -- quota tracking

-- Ground truth (answer keys — separate from items)
ground_truth_items, ground_truth_descriptions, ground_truth_attributes, ground_truth_specs
```

---

## Confidence & Scoring

### Two Metrics

| Metric | Range | Source | Meaning |
|--------|-------|--------|---------|
| `confidence_score` | 0–100 | Orchestrator | % of expected fields populated (coverage) |
| `field_confidence` | 0–1 | LLM self-report | Mean of 5 step confidences (calibration) |

### Status Logic
```typescript
hasCritical = manufacturer_name && brand_name && classpath
status = !hasCritical ? 'review'
       : confidence_score < 60 ? 'review'
       : 'enriched'
```

### Scoring (vs Ground Truth)
- **Match types**: `exact_match`, `close_match` (Levenshtein ≥85%), `mismatch`, `missing_in_output`, `extra_in_output`
- **Groups**: Identity, Taxonomy, Descriptions, Attributes, Specs
- **Calibration**: 4-quadrant note (e.g., "Overconfident — confidence overestimates accuracy")

---

## Quota Management

| Limit | Value |
|-------|-------|
| Daily requests | 18 (safety margin under 20) |
| Per item | 5 requests (one per step) |
| Batch default | 3 items (15 requests) |
| Check | Per-item before each step |
| Fail-open | On quota check error |

Dashboard shows real-time `used/limit` with near-limit warning.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | — | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | — | Anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Service role (server writes) |
| `GEMINI_API_KEY` | ✅ | — | Google AI Studio key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Model name |
| `DAILY_QUOTA_LIMIT` | No | `18` | Daily request cap |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Base URL for internal fetches |
| `DEBUG` | No | — | Enable structured logs |

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (typecheck + compile) |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run seed` | Load sample CSV into `items` |
| `npx tsc --noEmit` | TypeScript check only |

---

## Project Structure

```
InduIntel/
├── app/
│   ├── api/
│   │   ├── enrich/          # 5 steps + run + batch
│   │   ├── score/           # item, batch
│   │   └── items/           # list, detail, upload
│   ├── dashboard/
│   │   ├── page.tsx         # Main dashboard
│   │   ├── [item_id]/       # Item detail
│   │   └── insights/        # Analytics
│   └── layout.tsx, page.tsx
├── lib/
│   ├── ai/                  # Gemini client, schemas
│   ├── scoring/             # Comparison logic
│   ├── supabase/            # Server + admin clients
│   ├── api.ts               # Client fetch wrapper
│   ├── types.ts             # Shared interfaces
│   ├── utils.ts             # cn(), helpers
│   └── debug.ts             # Logging
├── components/ui/           # shadcn/ui components
├── scripts/                 # Seed, migrations, utilities
├── supabase/migrations/     # SQL migrations
├── PRD.md                   # Product Requirements
└── ARCHITECTURE.md          # Technical Architecture
```

---

## Known Limitations

- **Free-tier quota**: ~3 items/day (18 req/day ÷ 5 req/item). Production needs paid tier or async queue.
- **Baseline accuracy**: ~34% on sparse retail input. Root cause: text-only extraction from minimal descriptions (e.g., "Display Only"), distributor names instead of manufacturers.
- **Strong areas**: Taxonomy classification (50-100%), description char-limit compliance (100%), specs present in source text.
- **Weak areas**: Manufacturer identity (0% when input has distributor), attribute LOV compliance (12%), UPC/GTIN/dimensions (0% — not in source).

---

## Documentation

| Document | Description |
|----------|-------------|
| `PRD.md` | Product Requirements — features, API contracts, acceptance criteria |
| `ARCHITECTURE.md` | Technical Architecture — data flows, schema, LLM integration, security |

---

## License

MIT — feel free to use, modify, and distribute.