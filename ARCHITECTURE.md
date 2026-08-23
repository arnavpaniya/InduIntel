# InduIntel — Production Architecture

## End-to-end flow

```mermaid
flowchart TD
    A[Frontend<br/>Next.js Dashboard] -->|upload CSV| B[/api/items/upload/]
    A -->|enrichItem| C[/api/enrich/run/]
    A -->|fetchItems| D[/api/items/]
    A -->|export| E[/api/export/]
    A -->|usage chip| F[/api/usage/]

    B --> S[(Supabase<br/>items + relations)]
    D --> S
    F --> U[(gemini_usage_log)]

    C --> P1[manufacturer step]
    P1 --> P2[classify step]
    P2 --> P3[missing-field analysis<br/>deterministic]
    P3 -->|needed fields| P4[/api/enrich/external-evidence/]
    P3 -->|none needed| P5[attributes step]
    P4 --> EV
    EV[Evidence Service Client] --> PY[Python Evidence Service<br/>FastAPI services/evidence]

    PY --> T[Tavily Search API<br/>discovery only]
    T --> SR[Safe Retrieval<br/>SSRF guard · redirect hops ·<br/>streamed size cap · timeouts]
    SR --> SAN[HTML Sanitizer<br/>scripts/styles stripped]
    SAN --> IDV[Identity Verification<br/>MPN/manufacturer match]
    IDV -->|match| DE[Deterministic Extraction<br/>regex + unit normalization]
    IDV -->|mismatch| REJ[Reject → next candidate<br/>max 3 attempts]
    DE --> GS{needs_gemini?}
    GS -->|yes · evidence present| G[Gemini 2.5 Flash<br/>ONE batched call<br/>evidence lines only]
    GS -->|no| DONE
    G --> DONE[Apply via conflict resolver<br/>authority: verified_authoritative > verified_input > inferred]

    P5 --> P6[descriptions step]
    P6 --> P7[specs step]
    P7 --> CP[CanonicalProduct<br/>value_status + field_provenance]
    DONE --> CP

    CP --> S
    S --> EXP[252-column Mapper<br/>lib/unihack/output-mapper]
    EXP --> OUT[CSV / XLSX<br/>RFC4180 · byte-stable headers]
```

## Layer responsibilities

| Layer | Location | Notes |
|---|---|---|
| Frontend | `app/dashboard/**`, `app/page.tsx` | Reads backend status/confidence; usage chip from `/api/usage`; no mock data |
| Next.js API | `app/api/**` | Thin routes; auth token on writes; quota in batch route |
| Pipeline orchestrator (batch/offline) | `lib/pipeline/orchestrator.ts` | Identity→dedupe→missing-fields→evidence→conflicts→Gemini gate; bounded concurrency |
| Product intelligence | `lib/product-intelligence/*` | types, canonical, normalize, identity, conflicts, missing-fields, category-attributes |
| Input normalization | `lib/input/input-normalizer.ts` | Alias resolution, RFC4180 parse, conflict preservation |
| Evidence client | `lib/evidence/client.ts` | Timeout-bounded HTTP to Python service |
| Python evidence service | `services/evidence/*` | search (Tavily) → fetch → sanitize → identity → extract |
| Export | `lib/unihack/output-*`, `app/api/export` | Frozen 252-header contract |

## Where provenance & value status live

- `CanonicalProduct.value_status[field]`: `verified | inferred | unresolved | conflicting | invalid`
- `CanonicalProduct.field_provenance[field]`: `{source_type, source_url, source_title, evidence, confidence, retrieved_at}`
- Persisted through the enrichment tables; export mapper reads values only —
  statuses remain queryable for audits (`reports/data-quality-audit.json`).

## Authority priority (conflict resolution)

```
verified_authoritative (identity-matched external)
  > verified_input (organizer data)
  > inferred (Gemini from evidence)
```

Conflicts keep ALL candidate values and mark the field `conflicting`.
