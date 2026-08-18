# InduIntel — Command-Center UI Design System (v2)

## 1. Design Direction

**Style:** Dark Industrial Command-Center

The UI should feel:
- precise
- monitored
- alert
- authoritative
- technical
- calm under pressure

It should NOT feel like:
- a marketing SaaS dashboard
- a crypto/trading terminal (no neon overload)
- glassmorphism or soft/inflated surfaces
- a toy or playful interface

Core visual idea:

> A control room for industrial product data — the operator glances at a panel and instantly knows what's verified, what's missing, and what needs attention.

## 2. Design Rules

1. Dark base, flat surfaces, no gradients on backgrounds.
2. One accent color does the talking — used sparingly, never decoratively.
3. Hairline borders (1px), not shadows, separate panels.
4. Sharp-to-slightly-rounded corners (4–8px) — never pill-shaped, never heavily rounded.
5. Monospace type for all numbers, IDs, and status values.
6. Status is communicated by color + icon + label — never color alone.
7. Generous vertical rhythm; horizontal density is fine (this is a data tool).
8. Motion is functional, not decorative — state changes, not idle animation.

## 3. Color Palette

### Background layers
- App background: `#0B0D10`
- Panel surface: `#12151A`
- Raised panel (modals, drawers): `#171B21`
- Hairline border: `#262B33`

### Text
- Primary text: `#E7E9EC`
- Secondary text: `#8B929C`
- Disabled/muted: `#4E545D`

### Accent (single functional accent)
- Signal amber: `#F0A93E` — primary accent, CTAs, active states, focus rings

### Status colors
- Verified: `#4CAF7D` (signal green)
- Inferred: `#5B9BD5` (signal blue)
- Conflict: `#E05B4E` (signal red)
- Unknown: `#6B7280` (neutral gray)

No purple, no pink, no neon cyan, no glow effects.

## 4. Surface Treatment

- Panels: flat `#12151A` fill, `1px solid #262B33` border, 6px radius.
- No drop shadows for elevation — use border-color and slight background-lightness steps instead (`#12151A` → `#171B21` → `#1C2027` for stacking depth).
- Dividers inside panels: 1px `#1D2127`, full-bleed.
- Active/selected row: subtle left border in accent color (`3px solid #F0A93E`), background lightened one step.

## 5. Typography

Primary UI font: **Inter** or **IBM Plex Sans** (clean grotesk, not warm).

Numeric/data/monospace font: **JetBrains Mono** or **IBM Plex Mono** — use for:
- all specification values and units
- percentages, scores, IDs
- code-like metadata (document names, page numbers, timestamps)

### Type Scale
- Page title: 24–28px, Inter, medium
- Section title: 15–17px, Inter, medium, letter-spacing +0.02em, often uppercase for panel headers
- Body: 14px, Inter, regular
- Metadata/labels: 11–12px, Inter, uppercase, letter-spacing +0.05em, secondary text color
- Data values: 14–16px, JetBrains Mono, medium
- Large KPI numbers: 32–40px, JetBrains Mono, medium

## 6. Landing Page

Two sections, dark, terminal-adjacent but not gimmicky.

### Section 1 — Hero

```text
                        INDUINTEL

        Turn scattered product data into intelligence.

     AI-powered extraction, validation, and explainable
       product intelligence for industrial commerce.

              [ ENTER DASHBOARD → ]
```

### Section 2 — How It Works

Three panels in a row, numbered `01 / 02 / 03`, hairline-bordered, no icons required (monospace numerals carry the weight):

```text
01 IMPORT          02 UNDERSTAND       03 VALIDATE

Upload documents   AI extracts         Cross-check,
                    product data        enrich, explain
```

### Section 3 — Closing CTA

```text
Your product data. Understood.

[ OPEN INDUINTEL ]
```

## 7. Main Dashboard Navigation

Fixed dark sidebar, `#0B0D10`, hairline right border:

```text
┃ INDUINTEL
┃
┃ ▸ OVERVIEW
┃   PRODUCTS
┃   DOCUMENTS
┃
┃   VALIDATION
┃   EVIDENCE
┃
┃ ─────────────
┃   SETTINGS
```

## 8. Dashboard Overview

### KPI Panels

Four flat panels in a row:

```text
┌ PRODUCTS ANALYZED ─┐ ┌ COMPLETENESS ──┐ ┌ VERIFIED ATTRS ─┐ ┌ CONFLICTS ──┐
│                    │ │                 │ │                  │ │             │
│      128           │ │      91%        │ │      1,204       │ │     07      │
│                    │ │                 │ │                  │ │             │
└────────────────────┘ └─────────────────┘ └──────────────────┘ └─────────────┘
```

## 9. Product Detail — Main Demo Screen

Header:

```text
← PRODUCTS

ABB M3BP 160MLA
Industrial Electric Motor

┌ 94% COMPLETE ┐  ┌ 91% CONFIDENCE ┐
```

Tabs (underline style, not pill):

```text
OVERVIEW   SPECIFICATIONS   EVIDENCE   CONFLICTS   COMMERCE
─────────
```

Active tab: amber underline, amber text. Inactive: secondary text.

## 10. Specification Table

```text
KEY              VALUE            STATUS         
──────────────────────────────────────────────
POWER            5 HP             ● VERIFIED     Why?
VOLTAGE          415 V            ● VERIFIED     Why?
SPEED            1440 RPM         ● VERIFIED     Why?
EFFICIENCY       IE3              ● VERIFIED     Why?
IP RATING        IP55             ▲ CONFLICT     Why?
MOUNTING         B3               ◐ INFERRED     Why?
INSULATION       —                ○ UNKNOWN      —
```

## 11. "Why?" Evidence Drawer

Slides in from the right, `#171B21` panel, hairline left border, dim scrim (`rgba(0,0,0,0.6)`).

## 12. Final Design Principle

> **InduIntel is a control panel for trust in product data.** Every number on screen should look like it was measured, not decorated — status is read at a glance, and nothing claims certainty it hasn't earned.
