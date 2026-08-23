# Codebase Guide

Directory map with purpose and status of every major area.

```
InduIntel/
├── app/                        # Next.js App Router
│   ├── api/                    # Backend routes (thin, Supabase-backed)
│   │   ├── enrich/             # run | batch | manufacturer | classify |
│   │   │                       # missing-field-analysis (in run) |
│   │   │                       # external-evidence | attributes | descriptions | specs
│   │   ├── items/              # list | detail | upload (dynamic schema)
│   │   ├── export/             # 252-col CSV/XLSX
│   │   ├── usage/              # REAL Gemini quota for frontend
│   │   └── score/              # ground-truth scoring
│   └── dashboard/              # Catalog workspace UI (+ insights page)
├── components/ui/              # shadcn-style primitives
├── lib/
│   ├── ai/                     # Gemini client + usage tracker types
│   ├── evidence/client.ts      # Python service client
│   ├── export/                 # delivery-format mapper + CSV escaping
│   ├── input/                  # dynamic input normalizer
│   ├── pipeline/orchestrator.ts# batch/offline orchestration
│   ├── product-intelligence/   # canonical model, identity, conflicts, …
│   ├── supabase/               # server/admin clients
│   └── unihack/                # FROZEN 252-column schema + mappers
├── scripts/
│   ├── production/             # run-unihack-pipeline, apply-migration-010
│   ├── validation/             # validate-gate, output validator, env check,
│   │                           # supabase check, gemini/search smokes,
│   │                           # organizer inspector, stability-500
│   └── development/            # seed, reset, enrich_gt (GT workflow), legacy LLM runner
├── services/evidence/          # FastAPI evidence microservice (+ tests)
├── supabase/migrations/        # 001–010 (010 = external_evidence step)
├── tests/
│   ├── unit/                   # TS suites (harness in helpers/)
│   ├── e2e/                    # full-pipeline test + mock infra + real-Gemini run
│   └── synthetic/              # adversarial dataset generator
├── reports/                    # GENERATED evaluation artifacts (real metrics)
└── docs-files at root: README, ARCHITECTURE, CODEBASE, EVALUATION,
    DEPLOYMENT, PRD (original problem statement)
```

## Intentionally retained

| Item | Reason |
|---|---|
| `Unihack_ Sample Dataset - Input.csv` / `Unihack_ Expected Output - Delivery Format.csv` | Organizer reference artifacts; establish the 252-header contract |
| `PRD.md` | Original problem statement (linked from README) |
| `scripts/development/run_pipeline.ts` | Only standalone runner of the full LLM step chain against GT items |
| `scripts/production/apply-migration-010.ts` | Idempotent applier for pending migration (rpc or direct pg) |
| `reports/**` | Real execution evidence (validation JSON, audits, stability, sample outputs) |

## Intentionally excluded / removed

Historical one-shot debug & migration helper scripts (`check_*`, `enrich_gt2`,
`apply_cache_migration*`, `add_input_hash_*`, `fix_confidence_scale`,
`snapshot_gt`, `get_enriched`, `screenshots`), `dev.log`, `*.bak`, editor
folders (`.vscode`, `.commandcode`), Supabase CLI temp state (`supabase/.temp`),
and the personal `skills/` folder — all verified unreferenced before removal.
