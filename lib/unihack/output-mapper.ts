/**
 * UniHack Output Mapper
 * 
 * Converts the internal canonical product object into the exact UniHack
 * 252-column delivery format CSV row.
 * 
 * RULES (STRICTLY ENFORCED):
 * 1. Header names are NEVER determined by AI response.
 * 2. If a field is unavailable, return an explicit empty string "".
 * 3. Header order MUST match UNIHACK_HEADERS exactly.
 * 4. Every product produces exactly TOTAL_HEADERS (252) columns.
 * 5. No extra headers are ever emitted.
 * 6. No header is ever omitted.
 */

import { 
  UNIHACK_HEADERS, 
  HEADER_TO_INTERNAL, 
  INTERNAL_TO_HEADER, 
  validateHeaderOrder, 
  validateMappingIntegrity, 
  TOTAL_HEADERS,
  type UniHackHeader 
} from '@/lib/unihack/output-schema';
import type { CanonicalProduct } from '@/lib/product-intelligence/types';
import { canonicalToInternalFields } from '@/lib/product-intelligence/normalize';

interface InternalProductFields {
  mfg_part_num: string | null;
  part_desc: string | null;
  e1_brand: string | null;
  unilog_brand: string | null;
  dib_brand: string | null;
  part_manuf: string | null;
  manufacturer_name: string | null;
  brand_name: string | null;
  trade_name: string | null;
  alternate_part_number: string | null;
  dept: string | null;
  klass: string | null; // class is a reserved word, use klass
  fine: string | null;
  classpath: string | null;
  mobile_desc: string | null;
  invoice_desc: string | null;
  short_desc: string | null;
  long_desc1: string | null;
  retail_desc: string | null;
  marketing_description: string | null;
  mfg_part_num_for_features: string | null; // alias for part_desc for features
  item_features_1: string | null;
  item_features_2: string | null;
  item_features_3: string | null;
  item_features_4: string | null;
  item_features_5: string | null;
  item_features_6: string | null;
  item_features_7: string | null;
  item_features_8: string | null;
  item_features_9: string | null;
  item_features_10: string | null;
  item_features_11: string | null;
  item_features_12: string | null;
  item_features_13: string | null;
  item_features_14: string | null;
  item_features_15: string | null;
  item_features_16: string | null;
  item_features_17: string | null;
  item_features_18: string | null;
  item_features_19: string | null;
  item_features_20: string | null;
  attribute_label_1: string | null;
  attribute_value_1: string | null;
  attribute_uom_1: string | null;
  attribute_label_2: string | null;
  attribute_value_2: string | null;
  attribute_uom_2: string | null;
  attribute_label_3: string | null;
  attribute_value_3: string | null;
  attribute_uom_3: string | null;
  attribute_label_4: string | null;
  attribute_value_4: string | null;
  attribute_uom_4: string | null;
  attribute_label_5: string | null;
  attribute_value_5: string | null;
  attribute_uom_5: string | null;
  attribute_label_6: string | null;
  attribute_value_6: string | null;
  attribute_uom_6: string | null;
  attribute_label_7: string | null;
  attribute_value_7: string | null;
  attribute_uom_7: string | null;
  attribute_label_8: string | null;
  attribute_value_8: string | null;
  attribute_uom_8: string | null;
  attribute_label_9: string | null;
  attribute_value_9: string | null;
  attribute_uom_9: string | null;
  attribute_label_10: string | null;
  attribute_value_10: string | null;
  attribute_uom_10: string | null;
  attribute_label_11: string | null;
  attribute_value_11: string | null;
  attribute_uom_11: string | null;
  attribute_label_12: string | null;
  attribute_value_12: string | null;
  attribute_uom_12: string | null;
  attribute_label_13: string | null;
  attribute_value_13: string | null;
  attribute_uom_13: string | null;
  attribute_label_14: string | null;
  attribute_value_14: string | null;
  attribute_uom_14: string | null;
  attribute_label_15: string | null;
  attribute_value_15: string | null;
  attribute_uom_15: string | null;
  attribute_label_16: string | null;
  attribute_value_16: string | null;
  attribute_uom_16: string | null;
  attribute_label_17: string | null;
  attribute_value_17: string | null;
  attribute_uom_17: string | null;
  attribute_label_18: string | null;
  attribute_value_18: string | null;
  attribute_uom_18: string | null;
  attribute_label_19: string | null;
  attribute_value_19: string | null;
  attribute_uom_19: string | null;
  attribute_label_20: string | null;
  attribute_value_20: string | null;
  attribute_uom_20: string | null;
  attribute_label_21: string | null;
  attribute_value_21: string | null;
  attribute_uom_21: string | null;
  attribute_label_22: string | null;
  attribute_value_22: string | null;
  attribute_uom_22: string | null;
  attribute_label_23: string | null;
  attribute_value_23: string | null;
  attribute_uom_23: string | null;
  attribute_label_24: string | null;
  attribute_value_24: string | null;
  attribute_uom_24: string | null;
  attribute_label_25: string | null;
  attribute_value_25: string | null;
  attribute_uom_25: string | null;
  upc: string | null;
  ean: string | null;
  gtin: string | null;
  unspsc: string | null;
  list_price: number | null;
  length: number | null;
  length_uom: string | null;
  height: number | null;
  height_uom: string | null;
  width: number | null;
  width_uom: string | null;
  weight: number | null;
  weight_uom: string | null;
  country_of_origin: string | null;
  warranty: string | null;
  actual_image_flag: string | null;
  [key: string]: string | null | number | undefined;
}

/**
 * Map an internal product field to its UniHack header value.
 * If the header has no internal mapping (marked "null"), return "".
 * If the internal field is null/undefined, return "".
 * Otherwise, return the string value.
 */
function mapField(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === 'null') {
    return '';
  }
  return String(value);
}

/**
 * Get the internal field name for a given UniHack header.
 * Returns null if the header has no internal mapping (marked "null").
 */
function getInternalField(header: UniHackHeader): string | null {
  return HEADER_TO_INTERNAL[header];
}

/**
 * Type guard to check if a product is a CanonicalProduct.
 */
function isCanonicalProduct(product: any): product is CanonicalProduct {
  return (
    product != null &&
    typeof product === 'object' &&
    'id' in product &&
    Array.isArray(product.features) &&
    Array.isArray(product.attributes)
  );
}

/**
 * Convert a CanonicalProduct to InternalProductFields.
 * Reuses the existing mapping from the normalize module.
 */
function convertCanonicalToInternal(
  product: CanonicalProduct
): import('@/lib/unihack/output-mapper').InternalProductFields {
  return canonicalToInternalFields(product);
}

/**
 * Convert an internal canonical product object into a UniHack output row.
 * 
 * The product object should have all the internal fields populated from
 * the enrichment pipeline. Fields not available will result in empty strings.
 * 
 * @param product - Internal product fields or CanonicalProduct
 * @returns Array of exactly 252 string values, one per UniHack header
 */
function productToRow(product: InternalProductFields | CanonicalProduct): string[] {
  // If CanonicalProduct, convert to InternalProductFields first
  const internalProduct = isCanonicalProduct(product)
    ? convertCanonicalToInternal(product)
    : product;

  const row: string[] = [];

  for (const header of UNIHACK_HEADERS) {
    const internalField = getInternalField(header);
    if (internalField === 'null') {
      // Header has no internal mapping - always empty
      row.push('');
    } else if (internalField !== null) {
      // Map to internal field
      const value = internalProduct[internalField];
      row.push(mapField(value));
    } else {
      // Should not happen - type safety
      row.push('');
    }
  }

  // Strict validation: must produce exactly 252 columns
  if (row.length !== UNIHACK_HEADERS.length) {
    throw new Error(
      `ProductToRow produced ${row.length} columns, expected ${UNIHACK_HEADERS.length}. ` +
      `Mapping integrity broken.`
    );
  }

  return row;
}

/**
 * Generate empty row (all fields null) for use as default/placeholder.
 */
function emptyRow(): string[] {
  return new Array(UNIHACK_HEADERS.length).fill('');
}

/**
 * Validate that a row has exactly the expected number of columns.
 */
function validateRow(row: string[]): asserts row is string[] {
  if (row.length !== UNIHACK_HEADERS.length) {
    throw new Error(
      `Invalid row length: ${row.length}, expected ${UNIHACK_HEADERS.length}`
    );
  }
}

/**
 * Validate that all expected headers exist and mapping is intact.
 * Throws if configuration is broken.
 */
function validateSchema(): void {
  const mappingOk = validateMappingIntegrity();
  const orderOk = validateHeaderOrder(UNIHACK_HEADERS);

  if (!mappingOk) {
    throw new Error('Header mapping integrity check failed.');
  }
  if (!orderOk) {
    throw new Error('Header order does not match expected UniHack format.');
  }
}

// Run validation at module import time
validateSchema();

export { 
  productToRow, 
  emptyRow, 
  validateRow, 
  type InternalProductFields, 
  type CanonicalProduct,
  HEADER_TO_INTERNAL, 
  INTERNAL_TO_HEADER, 
  UNIHACK_HEADERS, 
  TOTAL_HEADERS 
};