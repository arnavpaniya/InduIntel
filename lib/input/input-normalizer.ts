/**
 * Input Normalization Layer (Stage 5, Parts 1 + 2)
 *
 * Deterministic normalization of ARBITRARY organizer CSV inputs into a
 * canonical internal representation, independent of the UniHack OUTPUT mapper.
 *
 * Guarantees:
 * - Handles any column order, missing/extra columns, empty/null/blank values,
 *   different capitalization, leading/trailing whitespace, duplicate rows,
 *   partially populated / sparse products.
 * - Ambiguous headers are NEVER aggressively merged; they stay unmapped.
 * - When two source columns resolve to the same internal field with different
 *   values, the CONFLICT is preserved (all raw contributions retained).
 * - Missing values stay unresolved. Invalid values are marked invalid.
 *   Nothing is ever invented here.
 *
 * This layer is deliberately separate from lib/unihack/output-* which remains
 * byte-for-byte unchanged (252-column delivery schema).
 */

import { parse as csvParse } from 'csv-parse/sync';

// ---------------------------------------------------------------------------
// Internal input-field namespace (input side only — never the output schema)
// ---------------------------------------------------------------------------

export type InternalInputField =
  // identity
  | 'mfg_part_num' | 'alternate_part_number' | 'sku'
  | 'manufacturer_name' | 'brand_name' | 'trade_name' | 'product_name'
  // taxonomy
  | 'dept' | 'class' | 'fine' | 'classpath'
  // descriptions
  | 'part_desc' | 'invoice_desc' | 'mobile_desc' | 'short_desc'
  | 'long_desc1' | 'retail_desc' | 'marketing_description'
  // specs
  | 'upc' | 'ean' | 'gtin' | 'unspsc' | 'list_price'
  | 'length' | 'width' | 'height' | 'weight'
  | 'country_of_origin' | 'warranty' | 'selling_qty'
  // info
  | 'standards_approvals' | 'prop_65' | 'application' | 'includes';

/** Fields that carry a unit-of-measure companion. */
export const UOM_FIELDS: Record<string, string> = {
  length: 'length_uom',
  width: 'width_uom',
  height: 'height_uom',
  weight: 'weight_uom',
};

// ---------------------------------------------------------------------------
// Header alias resolution
// ---------------------------------------------------------------------------

/**
 * Alias groups -> internal field. Matching is done on a normalized header key:
 * lowercase, all non-alphanumerics removed, so "MFR NAME", "mfr-name" and
 * "Manufacturer Name" all hit their group. Order inside the array does not
 * matter; collisions BETWEEN groups are guarded by AMBIGUOUS_HEADERS below.
 */
const HEADER_ALIASES: Array<{ field: InternalInputField; aliases: string[] }> = [
  // --- MPN family ---
  { field: 'mfg_part_num', aliases: [
    'mfgpartnum', 'mfgrpartnum', 'manufacturerpartnumber', 'manufacturerpartno',
    'manufacturerpartnum', 'manufpartnum', 'mpn', 'partnumber', 'partno', 'pn',
    'partnum', 'mfrpartnumber', 'mfgpartno', 'catalognumber', 'itemnumber',
    'skupart',
  ]},
  // --- Manufacturer family ---
  { field: 'manufacturer_name', aliases: [
    'manufacturer', 'manufacturermfr', 'mfr', 'mfg', 'mfrname', 'mfgname',
    'manufacturername', 'manufname', 'vendormanufacturer', 'maker',
  ]},
  // --- Brand family ---
  { field: 'brand_name', aliases: ['brand', 'brandname'] },
  { field: 'trade_name', aliases: ['tradename'] },
  { field: 'sku', aliases: ['sku', 'skucode', 'internalsku'] },
  { field: 'alternate_part_number', aliases: [
    'alternatepartnumber', 'altmpn', 'alternatempn', 'altpartnumber',
    'substitutepartnumber', 'equivpartnumber',
  ]},
  { field: 'product_name', aliases: ['productname', 'itemname'] },

  // --- Taxonomy ---
  { field: 'dept', aliases: ['dept', 'department'] },
  { field: 'class', aliases: ['class', 'subclass'] },
  { field: 'fine', aliases: ['fine', 'finetaxonomy'] },
  // Generic "category"-family headers resolve to classpath (the canonical
  // taxonomy path field) — unambiguous because no other group claims them.
  { field: 'classpath', aliases: [
    'classpath', 'categorypath', 'taxonomy', 'hierarchy',
    'category', 'producttype', 'productcategory', 'commodity',
  ]},

  // --- Descriptions ---
  { field: 'part_desc', aliases: [
    'partdesc', 'description', 'desc', 'productdescription', 'itemdescription',
    'longdescription', 'shortdescription', 'title',
  ]},
  { field: 'invoice_desc', aliases: ['invoicedesc', 'invoicedescription'] },
  { field: 'mobile_desc', aliases: ['mobiledesc', 'mobiledescription'] },
  { field: 'short_desc', aliases: ['shortdesc2', 'shortdescription2'] },
  { field: 'long_desc1', aliases: ['longdesc1', 'longdescription1'] },
  { field: 'retail_desc', aliases: ['retaildesc', 'retaildescription'] },
  { field: 'marketing_description', aliases: ['marketingdescription', 'marketing'] },

  // --- Specs / barcodes ---
  { field: 'upc', aliases: ['upc', 'upccode', 'upca'] },
  { field: 'ean', aliases: ['ean', 'eancode', 'ean13'] },
  { field: 'gtin', aliases: ['gtin', 'gtincode', 'gtin13', 'gtin14', 'gtin8'] },
  { field: 'unspsc', aliases: ['unspsc', 'unspsccode', 'commoditycode'] },
  { field: 'list_price', aliases: ['listprice', 'price', 'msrp', 'unitprice'] },

  // --- Dimensions / weight (with UOM-capable headers) ---
  { field: 'length', aliases: ['length', 'len'] },
  { field: 'width', aliases: ['width', 'wd'] },
  { field: 'height', aliases: ['height', 'ht'] },
  { field: 'weight', aliases: ['weight', 'netweight', 'shippingweight', 'grossweight', 'wt'] },

  { field: 'country_of_origin', aliases: [
    'countryoforigin', 'origin', 'country', 'countryofmanufacture', 'coo',
  ]},
  { field: 'warranty', aliases: ['warranty', 'warrantytinformation', 'warrantyterms'] },
  { field: 'selling_qty', aliases: ['sellingqty', 'packquantity', 'qtyperpack', 'unitsperpack'] },

  { field: 'standards_approvals', aliases: [
    'standardsapprovals', 'standardapprovals', 'certifications', 'certification', 'approvals',
  ]},
  { field: 'prop_65', aliases: ['prop65', 'proposition65', 'prop65warning'] },
  { field: 'application', aliases: ['application', 'applications', 'usecase', 'suitablefor'] },
  { field: 'includes', aliases: ['includes', 'includeditems', 'whatsincluded', 'kitcontents'] },
];

/** Headers that legitimately belong to more than one interpretation. */
const AMBIGUOUS_HEADERS = new Set([
  'model',          // could be MPN or product name
  'part',           // could be MPN or description
  'size',           // could be dimension or attribute
  'type',
  'code',
  'name',
  'value',
  'unit',
  'uom',
]);

/** Normalize a raw header into a comparison key. */
export function normalizeHeaderKey(header: string): string {
  return String(header ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\uFEFF]/g, '')   // zero-width / BOM residue
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');              // punctuation/spaces removed
}

/** Resolve a raw header to an internal field, or null when unrecognized. */
export function resolveHeader(header: string): InternalInputField | 'ambiguous' | null {
  const key = normalizeHeaderKey(header);
  if (!key) return null;

  // Exact ambiguous short-circuit ("Part", "Model", ...)
  if (AMBIGUOUS_HEADERS.has(key)) return 'ambiguous';

  // UOM companion headers: "WEIGHT_UOM", "Weight (kg)", "Length Unit"
  if (/(uom|unit)$/.test(key)) {
    const base = key.replace(/(uom|unit)$/, '');
    if (base in UOM_FIELDS || ['length', 'width', 'height', 'weight'].includes(base)) {
      return `${base}_uom` as InternalInputField;
    }
  }

  for (const group of HEADER_ALIASES) {
    if (group.aliases.includes(key)) {
      return group.field;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Value cleaning + validation
// ---------------------------------------------------------------------------

const PLACEHOLDER_VALUES = new Set([
  '-- unbranded --', '-- no unilog brand --', '-- no dib brand --',
  '-', '--', '---', 'n/a', 'na', 'n.a.', 'none', 'null', 'nil', 'tbd',
  'not applicable', 'notavailable', 'unknown', '', '#n/a', '#na',
]);

/** Clean a raw cell value: trim, strip invisible characters, drop placeholders. */
export function cleanCellValue(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw)
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\uFEFF\u0000]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (PLACEHOLDER_VALUES.has(s.toLowerCase())) return null;
  return s === '' ? null : s;
}

/** Parse a numeric cell. Returns {ok,value} — never guesses. */
export function parseNumeric(value: string | null): { ok: boolean; value: number | null } {
  if (value == null) return { ok: true, value: null };
  const cleaned = value.replace(/[,\s]/g, '').replace(/^\+/, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false, value: null };
  const n = Number(cleaned);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, value: null };
}

/** Split a trailing unit off a measurement value: "2.4 kg" -> {value,uom}. */
export function splitValueAndUom(
  value: string | null,
): { value: string | null; uom: string | null } {
  if (value == null) return { value: null, uom: null };
  const m = value.match(/^(-?[\d.,]+)\s*([A-Za-zµ°°]{1,6})\.?$/);
  if (m) return { value: m[1].trim(), uom: m[2].trim() };
  return { value, uom: null };
}

/** GS1 mod-10 check digit validation for UPC/EAN/GTIN codes. */
export function isValidGtinCode(code: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  let pos = 0;
  for (let i = digits.length - 1; i >= 0; i--, pos++) {
    sum += digits[i] * (pos % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === check;
}

/** Validate a barcode-typed field. */
export function validateBarcode(field: string, value: string | null):
  { value: string | null; valid: boolean } {
  if (value == null) return { value: null, valid: true };
  const digits = value.replace(/[\s-]/g, '');
  const expectedLen = field === 'upc' ? /^\d{12}$/ : field === 'ean' ? /^\d{13}$/ : null;
  if (expectedLen && !expectedLen.test(digits)) {
    // Accept alternate GTIN-family lengths for cross-typed columns, but still checksum them.
    if (isValidGtinCode(digits)) return { value: digits, valid: true };
    return { value: digits, valid: false };
  }
  return { value: digits, valid: isValidGtinCode(digits) };
}

// ---------------------------------------------------------------------------
// Row model
// ---------------------------------------------------------------------------

export type FieldResolutionStatus = 'verified' | 'invalid' | 'conflicting' | 'unresolved';

export interface FieldContribution {
  value: string | null;
  uom?: string | null;
  column: string;
  raw?: string;
}

export interface ResolvedFieldValue {
  field: string;
  value: string | number | boolean | null;
  uom: string | null;
  status: FieldResolutionStatus;
  /** Every distinct contributing value (conflict provenance — never discarded). */
  contributions: FieldContribution[];
  issue: string | null;
}

export interface NormalizedInputRow {
  rowIndex: number;
  /** internal field -> resolution */
  fields: Partial<Record<InternalInputField, ResolvedFieldValue>>;
  /** Source columns that produced no internal field, with reason. */
  unmappedColumns: Array<{ column: string; reason: 'ambiguous' | 'unrecognized' | 'empty' }>;
  /** Row index (within this dataset) this row exactly duplicates, if any. */
  exactDuplicateOf: number | null;
  /** Non-fatal data-quality issues detected during normalization. */
  issues: string[];
  raw: Record<string, string>;
}

export interface NormalizedInputResult {
  rows: NormalizedInputRow[];
  headers: string[];
  /** Rows dropped before normalization (unparseable CSV fragments). */
  malformedRowCount: number;
}

// ---------------------------------------------------------------------------
// Core normalization
// ---------------------------------------------------------------------------

/** Numeric fields that should be coerced to numbers. */
const NUMERIC_FIELDS = new Set<string>(['list_price', 'length', 'width', 'height', 'weight', 'selling_qty']);
/** Barcode fields with checksum validation. */
const BARCODE_FIELDS = new Set<string>(['upc', 'ean', 'gtin']);

function mergeContributions(
  field: string,
  contributions: FieldContribution[],
): ResolvedFieldValue {
  // Deduplicate identical values (different columns agreeing are NOT conflicts).
  const distinct: FieldContribution[] = [];
  const seen = new Set<string>();
  for (const c of contributions) {
    const norm = (c.value ?? '').normalize('NFKC').trim().toLowerCase();
    if (c.value != null && !seen.has(norm)) {
      seen.add(norm);
      distinct.push(c);
    }
  }

  const base: ResolvedFieldValue = {
    field,
    value: null,
    uom: null,
    status: 'unresolved',
    contributions: distinct,
    issue: null,
  };
  if (distinct.length === 0) return base;

  // UOM: take from first contributor that has one.
  base.uom = distinct.find((c) => c.uom)?.uom ?? null;

  if (NUMERIC_FIELDS.has(field)) {
    const parsed: Array<{ v: number; c: FieldContribution }> = [];
    for (const c of distinct) {
      const r = parseNumeric(c.value);
      if (!r.ok) {
        base.status = 'invalid';
        base.issue = `invalid numeric "${c.value}" for ${field} (column ${c.column})`;
        base.contributions = distinct; // preserve everything
        return base;
      }
      if (r.value != null) parsed.push({ v: r.value as number, c });
    }
    if (parsed.length === 0) return base;
    const differing = parsed.some((p) => p.v !== parsed[0].v);
    if (differing) {
      base.status = 'conflicting';
      base.issue = `conflicting ${field} values from input columns`;
      base.value = parsed[0].v; // highest-priority display value = first source order
      return base;
    }
    base.status = 'verified';
    base.value = parsed[0].v;
    return base;
  }

  if (BARCODE_FIELDS.has(field)) {
    const checked = validateBarcode(field, distinct[0].value);
    if (!checked.valid) {
      base.status = 'invalid';
      base.value = checked.value;
      base.issue = `invalid ${field} checksum/format "${distinct[0].value}"`;
      return base;
    }
    // Multiple DISTINCT barcode values for the same field -> conflict.
    if (new Set(distinct.map((d) => d.value)).size > 1) {
      base.status = 'conflicting';
      base.value = checked.value;
      base.issue = `conflicting ${field} values from input columns`;
      return base;
    }
    base.status = 'verified';
    base.value = checked.value;
    return base;
  }

  // Plain string fields
  if (distinct.length > 1) {
    base.status = 'conflicting';
    base.value = distinct[0].value;
    base.issue = `conflicting ${field} values from input columns`;
    return base;
  }
  base.status = 'verified';
  base.value = distinct[0].value;
  return base;
}

/** Normalize a single CSV record (header->value map) into a NormalizedInputRow. */
export function normalizeInputRecord(
  record: Record<string, unknown>,
  rowIndex: number,
  previousRows: NormalizedInputRow[],
): NormalizedInputRow {
  const buckets = new Map<InternalInputField | string, FieldContribution[]>();
  const unmapped: NormalizedInputRow['unmappedColumns'] = [];
  const issues: string[] = [];

  for (const [column, rawVal] of Object.entries(record)) {
    const target = resolveHeader(column);
    if (target === 'ambiguous') {
      unmapped.push({ column, reason: 'ambiguous' });
      continue;
    }
    if (target == null) {
      unmapped.push({ column, reason: 'unrecognized' });
      continue;
    }
    const cleaned = cleanCellValue(rawVal);
    if (cleaned == null) continue; // empty columns simply contribute nothing

    if (target.endsWith('_uom')) continue; // uom handled alongside its base field below

    let value = cleaned;
    let uom: string | null = null;

    if (UOM_FIELDS[target]) {
      const split = splitValueAndUom(cleaned);
      value = split.value ?? cleaned;
      uom = split.uom;
      const uomColumn = Object.keys(record).find(
        (c) => normalizeHeaderKey(c) === normalizeHeaderKey(`${target} uom`),
      );
      if (split.uom == null && uomColumn) {
        uom = cleanCellValue(record[uomColumn]);
      }
    }

    if (!buckets.has(target)) buckets.set(target, []);
    buckets.get(target)!.push({ value, uom, column, raw: String(rawVal ?? '') });
  }

  const fields: NormalizedInputRow['fields'] = {};
  for (const [field, contributions] of buckets.entries()) {
    const resolved = mergeContributions(field as string, contributions);
    fields[field as InternalInputField] = resolved;
    if (resolved.issue) issues.push(resolved.issue);
  }

  // Exact duplicate detection (all cleaned values equal to a previous row).
  let exactDuplicateOf: number | null = null;
  const fingerprint = JSON.stringify(
    Object.keys(record).sort().map((k) => [k, cleanCellValue(record[k])]),
  );
  for (let i = previousRows.length - 1; i >= 0; i--) {
    const prev = previousRows[i];
    const prevFp = JSON.stringify(
      Object.keys(prev.raw).sort().map((k) => [k, cleanCellValue(prev.raw[k])]),
    );
    if (prevFp === fingerprint) {
      exactDuplicateOf = prev.rowIndex;
      break;
    }
  }

  return {
    rowIndex,
    fields,
    unmappedColumns: unmapped,
    exactDuplicateOf,
    issues,
    raw: Object.fromEntries(Object.entries(record).map(([k, v]) => [k, v == null ? '' : String(v)])),
  };
}

/**
 * Parse + normalize a whole CSV document.
 * Uses csv-parse (RFC4180: quoted commas/newlines/escaped quotes, CRLF, BOM).
 * Rows whose column count diverges wildly are tolerated and reported.
 */
export function normalizeCsvInput(csvText: string | Buffer): NormalizedInputResult {
  const text = typeof csvText === 'string'
    ? csvText.replace(/^\uFEFF/, '')
    : csvText;

  let records: Array<Record<string, unknown>>;
  let malformedRowCount = 0;
  try {
    records = csvParse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: false,
      relax_column_count: true,
    }) as Array<Record<string, unknown>>;
  } catch (err) {
    throw new Error(`CSV parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const rows: NormalizedInputRow[] = [];
  for (let i = 0; i < records.length; i++) {
    try {
      rows.push(normalizeInputRecord(records[i] as Record<string, unknown>, i, rows));
    } catch {
      malformedRowCount++;
    }
  }

  const headers = records.length > 0 ? Object.keys(records[0] as Record<string, unknown>) : [];
  return { rows, headers, malformedRowCount };
}

/** Convenience accessor: get a cleaned string value for a field. */
export function fieldValue(row: NormalizedInputRow, field: InternalInputField): string | null {
  const f = row.fields[field];
  if (!f) return null;
  if (typeof f.value === 'string') return f.value;
  if (f.value == null) return null;
  return String(f.value);
}

/** Convenience accessor: numeric value for a field. */
export function fieldNumber(row: NormalizedInputRow, field: InternalInputField): number | null {
  const f = row.fields[field];
  if (!f || f.value == null || typeof f.value !== 'number') return null;
  return f.value;
}
