# InduIntel — Product Data Schema

## 1. Purpose

This is the canonical data contract for InduIntel.

The AI, backend, validation engine, and frontend should use this structure.

## 2. Product

```ts
type Product = {
  id: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  category: ProductCategory;

  attributes: ProductAttribute[];

  completeness: number;
  confidence: number;

  conflicts: Conflict[];
  missingAttributes: string[];

  documents: DocumentReference[];

  commerce: CommerceOutput | null;

  createdAt: string;
  updatedAt: string;
};
```

## 3. Categories

```ts
type ProductCategory =
  | "electric_motor"
  | "bearing"
  | "industrial_pump"
  | "unknown";
```

## 4. Attribute

```ts
type EvidenceStatus =
  | "VERIFIED"
  | "INFERRED"
  | "UNKNOWN"
  | "CONFLICT";

type ProductAttribute = {
  key: string;
  label: string;

  value: string | number | null;
  unit: string | null;

  normalizedValue?: string | number | null;
  normalizedUnit?: string | null;

  status: EvidenceStatus;
  confidence: number;

  evidence: Evidence[];
};
```

## 5. Evidence

```ts
type Evidence = {
  documentId: string;
  documentName: string;
  page: number;
  quote: string;
};
```

Evidence should be short and directly support the attribute.

## 6. Conflict

```ts
type Conflict = {
  id: string;
  attributeKey: string;

  values: {
    value: string | number;
    unit: string | null;
    source: Evidence;
  }[];

  recommendedValue: string | number | null;
  recommendedUnit: string | null;

  confidence: number;
  severity: "LOW" | "MEDIUM" | "HIGH";

  requiresHumanReview: boolean;
};
```

## 7. Document

```ts
type DocumentReference = {
  id: string;
  name: string;
  type: "pdf" | "csv" | "text";
  pageCount?: number;
};
```

## 8. Commerce Output

```ts
type CommerceOutput = {
  title: string;
  shortDescription: string;
  longDescription: string;
  keywords: string[];
  technicalSpecifications: {
    key: string;
    label: string;
    value: string;
  }[];
};
```

## 9. Electric Motor Attributes

Required:

```text
power
voltage
current
frequency
phase
speed
efficiency
efficiency_class
ip_rating
frame_size
mounting
insulation_class
duty
ambient_temperature
rated_torque
manufacturer
model
```

Optional:

```text
dimensions
weight
material
application
standards
certification
```

## 10. Bearing Attributes

Required:

```text
bearing_type
inner_diameter
outer_diameter
width
dynamic_load_rating
static_load_rating
limiting_speed
seal_type
material
manufacturer
model
```

Optional:

```text
lubrication
temperature_range
clearance
application
standard
```

## 11. Industrial Pump Attributes

Required:

```text
pump_type
flow_rate
head
power
voltage
frequency
speed
efficiency
material
manufacturer
model
```

Optional:

```text
inlet_size
outlet_size
temperature_range
pressure
application
seal_type
```

## 12. Attribute Status

### VERIFIED

Directly supported by source evidence.

### INFERRED

AI-derived and not directly stated.

### UNKNOWN

No reliable information found.

### CONFLICT

Reliable sources disagree.

## 13. Example

```json
{
  "key": "voltage",
  "label": "Voltage",
  "value": 415,
  "unit": "V",
  "status": "VERIFIED",
  "confidence": 0.97,
  "evidence": [
    {
      "documentId": "doc_001",
      "documentName": "motor-datasheet.pdf",
      "page": 3,
      "quote": "Rated voltage: 415 V"
    }
  ],
  "normalizedValue": 415,
  "normalizedUnit": "V"
}
```

## 14. AI JSON Rules

The AI must:

1. Return valid JSON.
2. Use exact schema keys.
3. Return null for unknown values.
4. Never invent technical specifications.
5. Attach evidence to VERIFIED values.
6. Preserve page numbers.
7. Keep evidence concise.
8. Use the correct category schema.
9. Separate numeric values and units where possible.
10. Return a 0–1 application confidence score.

## 15. Schema Principle

Do not create one giant universal industrial schema.

Each product category should define its own:
- required attributes
- optional attributes
- normalization rules
- validation rules
