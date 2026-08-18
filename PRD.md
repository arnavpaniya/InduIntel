# InduIntel — Product Requirements Document

## 1. Product

**Name:** InduIntel  
**Tagline:** Turn scattered product data into intelligence.

InduIntel is an AI-powered industrial product intelligence platform. It converts fragmented information from product datasheets, catalogs, technical documents, and other product sources into structured, enriched, validated, explainable, and commerce-ready product data.

## 2. Challenge Fit

InduIntel directly addresses the challenge through four core capabilities:

- **Extraction:** Convert unstructured product documents into structured attributes.
- **Enrichment:** Identify missing product attributes and add supported/inferred intelligence.
- **Validation:** Normalize specifications and detect contradictions across sources.
- **Explainability:** Attach evidence, source documents, page numbers, status, and confidence to product attributes.

## 3. Problem

Industrial product information is scattered across:

- Websites
- Product catalogs
- PDF datasheets
- Technical manuals
- Product specifications
- CSV/Excel files

The same product may appear with incomplete, inconsistent, duplicated, or differently formatted information.

Manually converting this information into product records is slow and error-prone.

## 4. Product Goal

Build a reliable hackathon MVP that can take an industrial product document and produce:

1. A structured product profile
2. Normalized specifications
3. Missing-attribute analysis
4. Cross-source conflict detection
5. Explainable evidence
6. Confidence/application-quality scores
7. A commerce-ready product listing
8. JSON/CSV export

## 5. Target User

Primary:
- Industrial product data managers
- B2B e-commerce/catalog teams
- Product information managers
- Procurement and sales teams

Hackathon persona:
> A product/catalog manager who needs to turn messy technical documents into trustworthy product data quickly.

## 6. MVP User Journey

1. Open InduIntel.
2. Upload a product PDF.
3. System reads and extracts document content.
4. AI identifies product category and extracts attributes.
5. System normalizes values and units.
6. System checks required attributes for that category.
7. System detects missing information.
8. System compares multiple sources when available.
9. System flags conflicts.
10. User sees completeness and confidence.
11. User clicks "Why?" beside an attribute.
12. Evidence drawer shows document, page, quote, status, and conflicting sources if present.
13. User generates a commerce-ready listing.
14. User exports JSON/CSV.

## 7. MVP Product Categories

Start with:

1. Industrial Electric Motor
2. Industrial Bearing
3. Industrial Pump

The architecture must be schema-driven so more categories can be added without rewriting the system.

## 8. Core Features

### P0 — Must Have

- PDF upload
- Document text/page extraction
- AI product classification
- Schema-driven specification extraction
- Product profile
- Attribute confidence
- Evidence/provenance
- Missing attribute detection
- Unit normalization
- Cross-source validation
- Conflict detection
- Completeness score
- Validation status
- Commerce-ready title/description
- JSON export
- Minimal polished dashboard

### P1 — Strongly Recommended

- CSV/TXT upload
- Evidence drawer
- Conflict review
- Product comparison
- Demo mode with cached analysis
- CSV export

### P2 — Optional

- Product image analysis
- Semantic search
- Duplicate detection
- Bulk document processing
- More industrial categories

## 9. AI Strategy

Do **not** train a custom AI model for the hackathon.

Use a pretrained local model through Ollama.

Preferred evaluation order:

1. Gemma 3 12B if the development computer can run it comfortably.
2. Qwen3-VL 8B if document/table/image understanding is important.
3. Gemma 3 4B for lower-resource machines.
4. Qwen3 8B when PDF text and tables are extracted cleanly before AI processing.

Keep the AI provider behind an adapter so Gemini or another model can be added later without changing the product logic.

## 10. Trust and Reliability Principles

InduIntel must never confidently invent a technical specification.

Every important attribute should have:

- Value
- Unit when applicable
- Status
- Confidence/application score
- Evidence
- Document
- Page

Attribute states:

### VERIFIED
Directly supported by a source.

### INFERRED
AI-derived or inferred and not directly stated.

### UNKNOWN
No reliable value found.

### CONFLICT
Two or more sources provide incompatible values.

## 11. Validation

Use deterministic code wherever possible.

Examples:

`5 horsepower` → `5 HP`

`5 hp` → `5 HP`

`0.415 kV` → `415 V`

If:

Source A → 415 V  
Source B → 440 V  
Source C → 415 V

Display:

- Conflict detected
- Candidate values
- Number of supporting sources
- Recommended value
- Application confidence
- Human review required

Do not describe the score as a scientifically calibrated probability.

## 12. Enrichment

For each product category, the system knows a set of expected attributes.

Example motor:

- Power
- Voltage
- Current
- Frequency
- Speed
- Efficiency
- IP Rating
- Frame Size
- Mounting
- Insulation Class

If fields are absent, the UI shows missing attributes.

If an AI inference is possible, it must be labeled **INFERRED**, never VERIFIED.

## 13. Commerce Output

Generate:

- Product title
- Short description
- Detailed description
- Technical specifications
- Search/filter attributes
- Keywords
- Validation status
- Confidence
- Evidence references

Commerce content must only use reliable/approved attributes.

## 14. Dashboard Requirements

The dashboard should be minimal.

Navigation:

- Overview
- Products
- Documents
- Validation
- Evidence
- Settings

Main overview should show:

- Products analyzed
- Data completeness
- Verified attributes
- Conflicts detected
- Recent products
- Conflict queue

## 15. Landing Page Requirements

The public landing page must contain only 2–3 sections:

### Hero
InduIntel  
Turn scattered product data into intelligence.

Primary CTA:
**Explore Dashboard**

### How It Works
Three steps:
1. Import
2. Understand
3. Validate & Enrich

### Final CTA
Short closing statement and dashboard button.

Do not create a long marketing website.

## 16. Success Criteria

A judge should be able to:

1. Upload an industrial PDF.
2. See structured specifications appear.
3. See missing attributes.
4. See validation/conflicts.
5. Click "Why?" and inspect evidence.
6. See completeness/confidence.
7. Generate commerce-ready output.
8. Export structured data.

## 17. Demo Strategy

The strongest demo uses a document set containing a real or intentionally prepared specification discrepancy.

Ideal sequence:

PDF → extraction → product profile → enrichment → conflict → evidence → commerce output.

Have a Demo Mode with cached analysis for known demo documents as a reliability fallback. Demo Mode must use previously generated real outputs, not fabricated claims.

## 18. Non-Goals

Do not spend hackathon time on:

- Training an LLM
- Enterprise ERP integration
- Large-scale web crawling
- Kubernetes
- Complex microservices
- Mobile application
- Real-time collaboration
- Full enterprise authentication
- Huge product taxonomy
- 50+ product categories

## 19. Product Principle

**InduIntel should never hide uncertainty.**

The product should feel like an intelligent industrial data analyst that shows its work, not a chatbot that guesses.
