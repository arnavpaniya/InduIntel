# InduIntel — Dashboard UI Design System

## 1. Design Direction

**Style:** Minimal Claymorphism × Industrial Intelligence

The UI should feel:

- soft
- tactile
- calm
- intelligent
- premium
- futuristic
- trustworthy

It should NOT feel like:

- a generic enterprise admin panel
- a neon AI dashboard
- a crypto product
- excessive glassmorphism
- a toy-like 3D interface

The core visual idea:

> A soft physical industrial control panel translated into a modern SaaS interface.

## 2. Design Rules

### Primary Rules

1. Claymorphism is the main visual language.
2. Keep the background relatively flat.
3. Use clay surfaces selectively.
4. Avoid bright colors.
5. Avoid shiny/glossy effects.
6. Use soft shadows rather than hard borders.
7. Use large rounded corners.
8. Keep layouts spacious.
9. Use subtle loading animations.
10. Typography should feel modern and distinctive.

### Important

Do NOT make every element look inflated.

Use clay for:
- KPI cards
- upload area
- product cards
- buttons
- status chips
- evidence drawer
- key panels

Keep tables and text areas visually calmer.

## 3. Color Palette

### Background

Warm stone:
`#E9E6DF`

### Main Clay

`#D8D3CA`

### Secondary Clay

`#C7C1B7`

### Deep Clay

`#B7B0A5`

### Primary Text

`#292825`

### Secondary Text

`#77736B`

### Muted Accent

Olive:
`#7B8068`

### Verified

Sage:
`#849783`

### Warning

Ochre:
`#A99469`

### Conflict

Terracotta:
`#A8786D`

No neon colors.

No bright cyan.

No glowing gradients.

## 4. Claymorphism Treatment

Use:

- border-radius: approximately 20–28px
- soft outer shadow
- subtle inner highlight
- low contrast between surface and background
- matte appearance

Conceptually:

```text
Background
   |
   +-- Soft clay card
         |
         +-- subtle top/left highlight
         +-- soft bottom/right shadow
```

Avoid:
- black drop shadows
- extreme blur
- glossy reflections
- heavy 3D extrusion

## 5. Typography

Primary recommendation:

**Space Grotesk**

Alternatives:
- Sora
- DM Sans

Avoid office-like defaults such as Arial or generic system typography.

### Type Scale

Page title:
28–36px

Section title:
18–22px

Body:
14–16px

Metadata:
12–13px

Large KPI:
32–48px

Use medium/bold weights selectively.

## 6. Landing Page

Only 2–3 sections.

### Section 1 — Hero

Large whitespace.

```text
                    INDUINTEL

          Turn scattered product data
                 into intelligence.

       AI-powered product enrichment,
       validation and explainable intelligence
              for industrial commerce.

              [ Explore Dashboard ]
```

Optional small floating clay product card:

```text
┌──────────────────────────┐
│ PRODUCT INTELLIGENCE     │
│                          │
│ Motor M3BP               │
│                          │
│ Completeness      94%    │
│ Confidence        91%    │
│ Conflicts          02    │
└──────────────────────────┘
```

Use only subtle movement.

### Section 2 — How It Works

Three clay tiles:

```text
01              02              03

IMPORT          UNDERSTAND      INTELLIGENCE

Upload          AI extracts     Validate,
documents       product data    enrich & explain
```

### Section 3 — CTA

```text
Your product data.
Understood.

[ Open InduIntel ]
```

No long marketing sections.

## 7. Main Dashboard Navigation

Minimal sidebar:

```text
╭──────────────────╮
│ INDUINTEL        │
│                  │
│ Overview         │
│ Products         │
│ Documents        │
│                  │
│ Validation       │
│ Evidence         │
│                  │
│ ───────────────  │
│ Settings         │
╰──────────────────╯
```

Do not add unnecessary navigation items.

## 8. Dashboard Overview

Header:

```text
Good morning.

Product Intelligence
Everything looks healthy.
```

### KPI Cards

Three or four cards:

- Products Analyzed
- Completeness
- Verified Attributes
- Conflicts

Each should be a soft clay surface.

Avoid excessive charts.

## 9. Product Detail — Main Demo Screen

This is the most important screen for the hackathon.

Header:

```text
← Products

ABB M3BP 160MLA
Industrial Electric Motor

94% Complete     91% Confidence
```

Tabs:

```text
Overview | Specifications | Evidence | Conflicts | Commerce
```

## 10. Product Health Card

```text
┌──────────────────────────────────────────┐
│ PRODUCT HEALTH                           │
│                                          │
│                 94%                      │
│                                          │
│         ████████████████░░               │
│                                          │
│  18 verified   3 inferred                │
│  2 missing     1 conflict                │
└──────────────────────────────────────────┘
```

Use a soft clay panel.

## 11. Specification Table

Rows:

```text
Power          5 HP             ✓
Voltage        415 V            ✓
Speed          1440 RPM         ✓
Efficiency     IE3              ✓
IP Rating      IP55             !
Mounting       B3               ~
```

Statuses:
- ✓ VERIFIED
- ~ INFERRED
- ! CONFLICT
- — UNKNOWN

Do not rely on color alone.

## 12. Signature Interaction — "Why?"

Every important specification should have a small:

**Why?**

Example:

```text
Voltage     415 V     ✓   Why?
```

Clicking it opens an evidence drawer.

### Evidence Drawer

```text
VOLTAGE

415 V

VERIFIED
97% confidence

Evidence

motor-datasheet.pdf
Page 03

"Rated voltage: 415 V"

────────────────────

Another source

catalog.pdf
Page 12

"Voltage: 440 V"

⚠ Conflict detected
```

This is the signature UX of InduIntel.

## 13. Conflict UI

```text
⚠ Specification Conflict

Voltage

415 V
2 sources

440 V
1 source

Recommended
415 V

87% application confidence

Human verification required
```

Conflicts must be visible and easy to understand.

## 14. Upload Screen

Large clay drop zone:

```text
┌──────────────────────────────────────────┐
│                                          │
│                  +                       │
│                                          │
│       Drop product documents here        │
│                                          │
│              PDF / CSV / TXT             │
│                                          │
│               Browse files               │
└──────────────────────────────────────────┘
```

After upload:

```text
Uploading       ✓
Reading         ✓
Understanding   ●
Validating      ○
Ready           ○
```

## 15. Enrichment Screen

```text
PRODUCT COMPLETENESS

82%

18 / 22 attributes available

Missing Attributes

⚠ Insulation Class
⚠ Mounting Type
⚠ Ambient Temperature
⚠ Rated Torque
```

For inferred values:

```text
Mounting Type
B3

78% confidence
AI inferred

[ Why? ]
```

## 16. Commerce Screen

```text
COMMERCE-READY

Product Title
ABB 5 HP IE3 Three-Phase Industrial Motor

Description
...

Technical Specifications
...

Search Attributes
...

Keywords
...

[ Copy Listing ] [ Export JSON ] [ Export CSV ]
```

## 17. Animation

Animations should be simple and slow.

### Loading

Use:

```text
Analyzing product

●  ●  ●
```

or a soft progress bar.

### Processing Timeline

Use small state transitions:

```text
✓ Uploaded
✓ Extracted
● Understanding
○ Validating
○ Ready
```

Motion:
- 300–500ms transitions
- soft fade
- subtle slide
- no bouncing

Avoid:
- spinning robots
- huge animated gradients
- excessive parallax
- constant motion

## 18. Buttons

Buttons should also use clay treatment.

Primary:
- slightly darker clay
- soft shadow
- dark text
- rounded pill/rounded rectangle

Secondary:
- flatter surface
- less depth

No glowing buttons.

## 19. Cards

Cards should use:
- 20–28px radius
- soft shadow
- subtle depth
- large internal padding

Avoid:
- too many cards
- cards inside cards inside cards

## 20. Tables

Tables should be visually calm.

Use:
- thin low-contrast separators or whitespace
- rounded outer container
- clear typography
- status chips
- hover state only

Do not turn every row into a floating clay card.

## 21. Responsive Design

Desktop-first.

Support:
- 1280px+
- 1024px laptop

Tablet should remain usable.

Mobile can be simplified.

## 22. Visual Hierarchy

The most important visual information is:

1. Product health
2. Completeness
3. Conflicts
4. Evidence
5. Specifications
6. Commerce output

## 23. Final Design Principle

The interface should communicate one idea:

> **InduIntel does not just give an answer. It shows why the answer can be trusted.**
