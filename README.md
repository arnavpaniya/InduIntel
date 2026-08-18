# InduIntel

**Turn scattered product data into intelligence.**

InduIntel is an AI-powered industrial product intelligence platform. It converts fragmented information from product datasheets, catalogs, and technical documents into structured, enriched, validated, explainable, and commerce-ready product data.

## Authors

- **Arnav Paniya**
- **Deepak Kumar**

## What it does

1. Upload an industrial product PDF (datasheet, catalog, spec sheet).
2. InduIntel extracts and classifies the product using a local AI model via Ollama.
3. Specifications are normalized, validated, and cross-checked across sources.
4. Every attribute is labeled **VERIFIED**, **INFERRED**, **UNKNOWN**, or **CONFLICT** — and backed by evidence (document, page, quote).
5. Conflicting values across sources are surfaced with a recommended value and confidence score.
6. A commerce-ready listing (title, description, specs, keywords) is generated from validated data.
7. Export structured product data as JSON or CSV.

## Why

Industrial product information is scattered across websites, catalogs, PDFs, and spreadsheets — often incomplete, inconsistent, or duplicated. InduIntel turns that mess into trustworthy, explainable product records without ever inventing a specification it can't back up.

## Tech stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **AI:** Ollama (local models — Gemma 3 / Qwen3), behind a provider-agnostic adapter
- **Backend:** Next.js Route Handlers
- **Database:** Supabase (Postgres + Row Level Security)
- **Document processing:** PyMuPDF (or equivalent) for PDF text/table/page extraction

## Core principles

- **AI is replaceable.** All model calls go through an `AIProvider` interface — no vendor lock-in.
- **Validation is deterministic.** Units, conflicts, and completeness are computed in code, not guessed by the model.
- **Evidence travels with data.** Every verified value points back to its source document and page.
- **The UI never invents missing values.** Unknown means unknown — shown honestly, not filled in.

## Project structure

```text
induintel/
├── docs/            PRD, Architecture, Schema, Design, Security specs
├── src/
│   ├── app/         Pages and API routes
│   ├── components/  UI components (clay design system)
│   ├── lib/         AI, PDF parsing, validation, normalization, export
│   ├── schemas/      Per-category product schemas (motor, bearing, pump)
│   └── types/        Shared TypeScript types
├── scripts/
└── tests/
```

## Getting started

```bash
# install dependencies
npm install

# configure environment
cp .env.example .env.local
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# OLLAMA_HOST, OLLAMA_MODEL (and OLLAMA_API_KEY if applicable)

# run the dev server
npm run dev
```

## Supported product categories (MVP)

- Industrial Electric Motor
- Industrial Bearing
- Industrial Pump

The schema-driven design means new categories can be added without rewriting the extraction or validation logic.

## Security

All uploaded documents and AI-generated output are treated as untrusted data. See `docs/SECURITY.md` for the full threat model, upload validation, prompt-injection protections, and authorization rules.

## Status

Hackathon MVP — see `docs/PRD.md` for the full product requirements and success criteria.
