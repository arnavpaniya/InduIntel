# InduIntel — System Architecture

## 1. Architecture Philosophy

Keep the system:

- Simple
- Modular
- Local-first for the hackathon
- AI-provider independent
- Deterministic where possible
- Evidence-first
- Easy to vibe-code

The AI model performs understanding and extraction.

Application code performs normalization, validation, scoring, storage, and presentation.

## 2. High-Level Flow

```text
                    INDUSTRIAL PDF
                          |
                          v
                +-------------------+
                | Document Processor|
                | Text / Pages      |
                | Tables / Evidence |
                +---------+---------+
                          |
                          v
                +-------------------+
                |  AI Orchestrator  |
                |      Ollama       |
                +---------+---------+
                          |
                          v
                +-------------------+
                | Structured Output |
                | Product Attributes|
                +---------+---------+
                          |
             +------------+-------------+
             |            |             |
             v            v             v
       Normalization  Validation   Completeness
             |            |             |
             +------------+-------------+
                          |
                          v
                +-------------------+
                | Evidence & Score  |
                +---------+---------+
                          |
                          v
                +-------------------+
                | Product Intelligence|
                +---------+---------+
                          |
                +---------+----------+
                |                    |
                v                    v
          Dashboard UI        Commerce Output
                             JSON / CSV / Copy
```

## 3. Recommended Technology

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui where useful
- Lucide icons
- Recharts only where charts genuinely improve understanding
- Framer Motion for subtle transitions

### AI

- Ollama
- Gemma 3 12B — preferred if hardware permits
- Qwen3-VL 8B — preferred for visual/table-heavy document tests
- Gemma 3 4B — lightweight fallback
- Qwen3 8B — text-first fallback

### Document Processing

Use PyMuPDF or another reliable local PDF extraction library.

The parser should preserve page numbers.

Represent extracted content as:

```ts
type DocumentChunk = {
  documentId: string;
  page: number;
  text: string;
  type: "text" | "table" | "image";
};
```

### Backend

For MVP:
- Next.js Route Handlers / server actions
- TypeScript

A separate Python service is not required initially.

## 4. Local-First AI

Ollama runs locally:

```text
Browser
   |
   v
Next.js
   |
   v
Server-side AI adapter
   |
   v
Ollama
   |
   v
Local model
```

Do not expose Ollama directly to the browser.

## 5. AI Provider Abstraction

Use:

```ts
interface AIProvider {
  analyzeProduct(input: AIInput): Promise<ProductExtraction>;
}
```

Implement:

```text
AIProvider
├── OllamaProvider
├── MockProvider
└── GeminiProvider (future)
```

This ensures the project is not locked to one model.

## 6. Processing Stages

### Stage 1 — Upload

Validate:
- file type
- file size
- extension

Create document record.

### Stage 2 — Parse

Extract:
- text
- page numbers
- table-like content
- page images if needed

### Stage 3 — Classify

AI identifies:
- category
- manufacturer
- model
- likely schema

If the user selects a category manually, preserve the user's choice.

### Stage 4 — Extract

AI receives relevant document content and returns structured JSON.

Rules:
- exact schema keys
- null for unknown values
- no invented specifications
- evidence for verified values
- page number when available

### Stage 5 — Normalize

Deterministically normalize:
- units
- casing
- whitespace
- synonyms
- numeric representations

### Stage 6 — Validate

Compare values across documents.

Checks:
- missing required attributes
- conflicting values
- duplicate fields
- suspicious values
- unit inconsistencies

### Stage 7 — Score

Calculate:
- completeness
- application confidence
- conflict count

The score must be explainable.

### Stage 8 — Evidence

Attach evidence records to attributes.

```ts
type Evidence = {
  documentId: string;
  documentName: string;
  page: number;
  quote: string;
};
```

### Stage 9 — Commerce

Generate listing content from reliable product data.

## 7. Suggested Folder Structure

```text
induintel/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── SCHEMA.md
│   └── DESIGN.md
│
├── public/
│   └── demo/
│
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── documents/
│   │   ├── validation/
│   │   └── api/
│   │
│   ├── components/
│   │   ├── clay/
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── evidence/
│   │   ├── validation/
│   │   └── ui/
│   │
│   ├── lib/
│   │   ├── ai/
│   │   ├── pdf/
│   │   ├── validation/
│   │   ├── normalization/
│   │   ├── enrichment/
│   │   └── export/
│   │
│   ├── schemas/
│   │   ├── motor.ts
│   │   ├── bearing.ts
│   │   └── pump.ts
│   │
│   ├── types/
│   └── data/
│
├── scripts/
├── tests/
├── .env.example
├── AGENTS.md
├── package.json
└── README.md
```

## 8. API Endpoints

### POST `/api/documents/upload`
Upload and register document.

### POST `/api/analyze`
Process document and create product intelligence.

### GET `/api/products/:id`
Return product.

### GET `/api/products/:id/evidence`
Return evidence.

### GET `/api/products/:id/conflicts`
Return conflicts.

### POST `/api/products/:id/commerce`
Generate commerce output.

### GET `/api/products/:id/export`
Export JSON/CSV.

## 9. Demo Mode

Implement:

```text
Demo Mode
    |
Known demo document
    |
Cached real analysis
    |
Validation + dashboard
```

This prevents demo failure if local AI is slow or unavailable.

## 10. Error Handling

If AI fails:
- preserve document
- show retry
- do not invent fallback values

If JSON is invalid:
- validate against schema
- attempt one repair
- show extraction failure if repair fails

If evidence is missing:
- mark UNKNOWN

If sources conflict:
- mark CONFLICT
- require review

## 11. Security

- Never expose Ollama internals to client code.
- Validate uploads.
- Limit file size.
- Sanitize extracted text.
- Never execute uploaded content.
- Keep model/API configuration server-side.

## 12. Architecture Rules

1. AI is replaceable.
2. Validation is deterministic.
3. Evidence travels with data.
4. UI never invents missing values.
5. Do not introduce new frameworks without a clear reason.
6. Keep the first version local and simple.
