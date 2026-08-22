/** Category-aware attribute extraction framework.
 *
 * Provides category context (dept/class/fine/classpath), attribute relevance
 * filtering per category, synonym normalization, and quality controls to
 * prevent duplicates, empty labels/values, irrelevant attributes, and fake
 * values. Only returns attributes supported by available information.
 */

import { CanonicalProduct } from './types';
import { ProductAttribute, ProductFeature } from './types';
import { ProductFieldStatus, ProductFieldProvenance } from './types';

/** Category identifiers from the UniHack taxonomy. */
export type CategoryPath = 'industrial' | 'electronics' | 'automotive' | 'construction' | 'consumer' | 'medical' | 'other';

/** Category context derived from CanonicalProduct taxonomy fields. */
export interface CategoryContext {
  dept: string | null;
  klass: string | null;
  fine: string | null;
  classpath: string | null;
  /** Normalized primary category (dept or first classpath segment) */
  primary: string;
}

/** Attribute relevance per category. Attributes that are relevant/optional
 * for a given category; others are excluded as irrelevant. */
export interface CategoryAttributeRelevance {
  industrial?: string[];
  electronics?: string[];
  automotive?: string[];
  construction?: string[];
  consumer?: string[];
  medical?: string[];
  other?: string[];
}

/** Normalized synonymous labels map. Maps common label variations to a
 * canonical form so that e.g. "Voltage" and "Voltage Rating" resolve to
 * the same attribute. */
export const SYNONYMOUS_LABELS: Record<string, string> = {
  voltage: 'voltage',
  'voltage rating': 'voltage',
  'voltage (v)': 'voltage',
  power: 'power_rating',
  'power rating': 'power_rating',
  horsepower: 'power_rating',
  current: 'current',
  'current (a)': 'current',
  amperage: 'current',
  resistance: 'resistance',
  temp: 'temperature',
  'temperature rating': 'temperature',
  'temp rating': 'temperature',
};

/** Extract attributes from a CanonicalProduct, filtered by category context.
 *
 * Quality controls enforced:
 * - No duplicate labels (first-wins)
 * - No empty labels or values (filtered out)
 * - No irrelevant attributes for the given category
 * - No "fake" / placeholder values
 * - Synonym labels normalized to canonical form
 *
 * Only attributes with supported values from the product data are returned.
 */
export function extractAttributes(
  product: CanonicalProduct,
  categoryPath: CategoryPath = 'other'
): ProductAttribute[] {
  const ctx = categoryContext(product);
  const relevant = relevantAttributes(categoryPath);

  // Collect attributes from product.attributes (label/value pairs)
  const seen = new Set<string>();
  const result: ProductAttribute[] = [];

  for (const attr of product.attributes || []) {
    const label = normalizeLabel(attr.label);

    // Skip empty labels
    if (!label || label.trim() === '') continue;

    // Skip duplicates (first-wins)
    if (seen.has(label)) continue;
    seen.add(label);

    // Skip irrelevant attributes for this category
    if (!isRelevant(label, relevant)) continue;

    // Skip fake/placeholder values
    if (isFakeValue(attr.value)) continue;

    // Skip empty values
    if (!attr.value || attr.value.trim() === '') continue;

    const normalized = SYNONYMOUS_LABELS[label.toLowerCase()] || label;
    const value = attr.value.trim();
    const uom = attr.uom ? attr.uom.trim() : undefined;
    const confidence = attr.confidence != null ? attr.confidence : undefined;
    const provenance = attr.provenance || undefined;

    result.push({
      label: normalized,
      value,
      uom,
      confidence,
      provenance,
    });
  }

  // Also extract from features if they contain attribute-like data
  // (features are separate from attributes but may contain relevant info)
  for (const feature of product.features || []) {
    const label = normalizeLabel(feature.name ?? '');

    if (!label || label.trim() === '') continue;
    if (seen.has(label)) continue;
    seen.add(label);

    if (!isRelevant(label, relevant)) continue;
    if (isFakeValue(feature.value)) continue;
    if (!feature.value || feature.value.trim() === '') continue;

    const normalized = SYNONYMOUS_LABELS[label.toLowerCase()] || label;
    const value = feature.value.trim();

    result.push({
      label: normalized,
      value,
      provenance: feature.provenance,
    });
  }

  return result;
}

/** Derive category context from product taxonomy fields. */
function categoryContext(product: CanonicalProduct): CategoryContext {
  const dept = product.dept ?? '';
  const klass = product.klass ?? '';
  const fine = product.fine ?? '';
  const classpath = product.classpath ?? '';

  // Determine primary category: dept if available, otherwise first classpath segment
  const primary = dept || classpath.split('/')[0] || 'other';

  return { dept, klass, fine, classpath, primary };
}

/** Return the list of relevant attribute labels for a given category. */
function relevantAttributes(categoryPath: CategoryPath): string[] {
  const map: CategoryAttributeRelevance = {
    industrial: [
      'voltage',
      'current',
      'power_rating',
      'resistance',
      'temperature',
      'frequency',
      'phase',
      'horsepower',
      'rpm',
      'efficiency',
      'protection_rating',
      'material',
      'dimensions',
      'weight',
      'mounting_type',
    ],
    electronics: [
      'voltage',
      'current',
      'power_rating',
      'frequency',
      'phase',
      'temperature',
      'capacitance',
      'inductance',
      'resistance',
      'efficiency',
      'connection_type',
      'housing_material',
      'dimensions',
      'weight',
    ],
    automotive: [
      'voltage',
      'current',
      'power_rating',
      'resistance',
      'temperature',
      'frequency',
      'phase',
      'mounting_type',
      'connector_type',
      'material',
      'dimensions',
      'weight',
      'ip_rating',
    ],
    construction: [
      'dimensions',
      'weight',
      'material',
      'load_capacity',
      'temperature',
      'corrosion_rating',
      'certification',
      'mounting_type',
    ],
    consumer: [
      'voltage',
      'current',
      'power_rating',
      'frequency',
      'dimensions',
      'weight',
      'material',
      'connection_type',
    ],
    medical: [
      'voltage',
      'current',
      'power_rating',
      'dimensions',
      'weight',
      'material',
      'sterilization_compatible',
      'regulatory_approval',
    ],
  };

  const entry = map[categoryPath];
  return entry || map.other || [];
}

/** Check whether a label is relevant for the given category's attribute list. */
function isRelevant(label: string, relevant: string[]): boolean {
  const lower = label.toLowerCase();
  // Direct match
  if (relevant.some(r => r.toLowerCase() === lower)) return true;
  // Synonym match: check if any known synonym maps to the same canonical form
  for (const [, canonical] of Object.entries(SYNONYMOUS_LABELS)) {
    if (canonical.toLowerCase() === lower && relevant.some(r => r.toLowerCase() === canonical.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** Check whether a value is a fake/placeholder value that should be excluded. */
function isFakeValue(value: string): boolean {
  const lower = value.toLowerCase().trim();
  // Common placeholder/fake values
  const fakePatterns = [
    /^--$/,
    /^n\/a$/,
    /^not.applicable$/,
    /^tbd$/i,
    /^pending$/i,
    /^unknown$/i,
    /^na$/i,
    /^null$/i,
    /^no information$/i,
    /^to be determined$/i,
  ];
  return fakePatterns.some((pat) => pat.test(lower));
}

/** Normalize a label string: trim, lower-case, remove surrounding whitespace. */
function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}