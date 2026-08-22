/**
 * Normalization Utilities
 * 
 * Utilities for normalizing and converting between different product representations.
 * All normalization follows the important data rule: never populate missing values
 * with guesses. Unavailable values remain null or empty string.
 */

// ---- Type Imports from types.ts (type-only for isolatedModules) ----

import type { 
  CanonicalProduct, 
  ProductFieldProvenance, 
  ProductFieldStatus, 
  ProductFeature, 
  ProductAttribute, 
  ProductAsset 
} from '@/lib/product-intelligence/types';

// ---- Runtime Import from types.ts ----

import { ProductAssetType } from '@/lib/product-intelligence/types';

// ---- Function Imports from canonical.ts (runtime adapter) ----

import { 
  transformSupabaseProductToCanonical
} from '@/lib/product-intelligence/canonical';

// ---- Utility Functions ----

/** Trim and sanitize string values, returning null for empty/whitespace-only strings */
function normalizeString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Normalize a number, returning null for undefined/NaN */
function normalizeNumber(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

/** Normalize a boolean, returning null for undefined */
function normalizeBoolean(value: boolean | null | undefined): boolean | null {
  if (value === undefined) return null;
  return value;
}

/** Normalize a ProductFeature, ensuring non-empty name and value */
function normalizeFeature(feature: Partial<ProductFeature>): ProductFeature {
  return {
    name: feature.name != null ? String(feature.name).trim() || 'Unnamed Feature' : 'Unnamed Feature',
    value: feature.value != null ? String(feature.value).trim() : '',
    provenance: feature.provenance || undefined,
    status: feature.status as ProductFieldStatus | undefined,
  };
}

/** Normalize a ProductAttribute, ensuring label and value are present */
function normalizeAttribute(attr: Partial<ProductAttribute>): ProductAttribute {
  return {
    label: attr.label != null ? String(attr.label).trim() : '',
    value: attr.value != null ? String(attr.value).trim() : '',
    normalized_value: attr.normalized_value != null ? String(attr.normalized_value).trim() : undefined,
    uom: attr.uom != null ? String(attr.uom).trim() : undefined,
    confidence: attr.confidence != null ? Number(attr.confidence) : undefined,
    provenance: attr.provenance || undefined,
    status: attr.status as ProductFieldStatus | undefined,
  };
}

/** Normalize a ProductAsset, ensuring type and URL are present */
function normalizeAsset(asset: Partial<ProductAsset>): ProductAsset {
  const type = asset.type != null ? asset.type : ProductAssetType.reference_url;
  return {
    type: typeof type === 'string' ? (type as ProductAssetType) : type,
    url: asset.url != null ? String(asset.url).trim() : '',
    title: asset.title != null ? String(asset.title).trim() : undefined,
    provenance: asset.provenance || undefined,
  };
}

/** Convert an EnrichedItem from the existing types into a CanonicalProduct.
 *  This is the primary adapter from Supabase data to the canonical model.
 *  Never populates missing values with guesses.
 */
function enrichItemToCanonical(
  item: import('@/lib/types').EnrichedItem
): CanonicalProduct {
  return transformSupabaseProductToCanonical(
    item as any,
    (item as any).item_descriptions || [],
    (item as any).item_attributes || [],
    ((item as any).item_specs || [])[0] || null,
    (item as any).item_assets || []
  );
}

/** Map Supabase asset_type strings to ProductAssetType enum */
function mapSupabaseAssetType(assetType: string | null | undefined): ProductAssetType {
  const mapping: Record<string, ProductAssetType> = {
    'product_image': ProductAssetType.product_image,
    'spec_sheet': ProductAssetType.specification_sheet,
    'manual': ProductAssetType.instruction_manual,
    'mfr_url': ProductAssetType.manufacturer_url,
    'ref_url': ProductAssetType.reference_url,
    'sds': ProductAssetType.SDS,
    'warranty_information': ProductAssetType.warranty_information,
    'catalog': ProductAssetType.catalog,
    'specification_sheet': ProductAssetType.specification_sheet,
    'instruction_manual': ProductAssetType.instruction_manual,
    'service_manual': ProductAssetType.service_manual,
    'owners_manual': ProductAssetType.owners_manual,
    'line_drawing': ProductAssetType.line_drawing,
    'mtr': ProductAssetType.MTR,
    'rohs': ProductAssetType.RoHS,
    'engineering_drawing': ProductAssetType.engineering_drawing,
    'energy_star_guide': ProductAssetType.energy_star_guide,
    'technical_bulletin': ProductAssetType.technical_bulletin,
    'submittal': ProductAssetType.submittal,
    'compatibility_chart': ProductAssetType.compatibility_chart,
    'size_chart': ProductAssetType.size_chart,
    'product_label': ProductAssetType.product_label,
    'video': ProductAssetType.video,
    'image_1': ProductAssetType.alternate_image,
    'image_2': ProductAssetType.alternate_image,
    'image_3': ProductAssetType.alternate_image,
    'image_4': ProductAssetType.alternate_image,
    'image_5': ProductAssetType.alternate_image,
  };
  
  if (assetType == null) return ProductAssetType.reference_url;
  const mapped = mapping[assetType.toLowerCase()];
  return mapped != null ? mapped : ProductAssetType.reference_url;
}

/** Convert a CanonicalProduct back to InternalProductFields (used by existing UniHack mapper). */
function canonicalToInternalFields(product: CanonicalProduct): import('@/lib/unihack/output-mapper').InternalProductFields {
  // Extract the first few features for ITEM_FEATURES_1-20
  const features: Record<string, string | null> = {};
  for (let i = 0; i < product.features.length; i++) {
    features[`item_features_${i + 1}`] = product.features[i]?.value ?? null;
  }
  // Fill remaining with null
  for (let i = product.features.length; i < 20; i++) {
    features[`item_features_${i + 1}`] = null;
  }

  // Extract the first few attributes for attribute_label_1-50 / attribute_value_1-50 / attribute_uom_1-50
  const attributes: Record<string, string | null> = {};
  for (let i = 0; i < product.attributes.length; i++) {
    const attr = product.attributes[i];
    if (attr) {
      attributes[`attribute_label_${i + 1}`] = attr.label ?? null;
      attributes[`attribute_value_${i + 1}`] = attr.value ?? null;
      attributes[`attribute_uom_${i + 1}`] = attr.uom ?? null;
    }
  }
  // Fill remaining with null
  for (let i = product.attributes.length; i < 50; i++) {
    attributes[`attribute_label_${i + 1}`] = null;
    attributes[`attribute_value_${i + 1}`] = null;
    attributes[`attribute_uom_${i + 1}`] = null;
  }

  // Explicitly map all feature and attribute fields to match InternalProductFields
  const internalProduct: import('@/lib/unihack/output-mapper').InternalProductFields = {
    // Core item fields
    mfg_part_num: product.mfg_part_num,
    part_desc: product.part_desc ?? null,
    e1_brand: null, // not in canonical model directly
    unilog_brand: null, // not in canonical model directly
    dib_brand: null, // not in canonical model directly
    part_manuf: null, // not in canonical model directly
    manufacturer_name: product.manufacturer_name,
    brand_name: product.brand_name,
    trade_name: product.trade_name,
    alternate_part_number: product.alternate_part_number,
    dept: product.dept,
    klass: product.klass,
    fine: product.fine,
    classpath: product.classpath,
    mfg_part_num_for_features: product.part_desc ?? null,

    // Descriptions
    mobile_desc: product.mobile_desc,
    invoice_desc: product.invoice_desc,
    short_desc: product.short_desc,
    long_desc1: product.long_desc1,
    retail_desc: product.retail_desc,
    marketing_description: product.marketing_description,

    // ITEM_FEATURES_1 through ITEM_FEATURES_20 - explicit mapping
    item_features_1: features.item_features_1,
    item_features_2: features.item_features_2,
    item_features_3: features.item_features_3,
    item_features_4: features.item_features_4,
    item_features_5: features.item_features_5,
    item_features_6: features.item_features_6,
    item_features_7: features.item_features_7,
    item_features_8: features.item_features_8,
    item_features_9: features.item_features_9,
    item_features_10: features.item_features_10,
    item_features_11: features.item_features_11,
    item_features_12: features.item_features_12,
    item_features_13: features.item_features_13,
    item_features_14: features.item_features_14,
    item_features_15: features.item_features_15,
    item_features_16: features.item_features_16,
    item_features_17: features.item_features_17,
    item_features_18: features.item_features_18,
    item_features_19: features.item_features_19,
    item_features_20: features.item_features_20,

    // Attributes (label/value/uom 1-50) - explicit all 50
    attribute_label_1: attributes.attribute_label_1,
    attribute_value_1: attributes.attribute_value_1,
    attribute_uom_1: attributes.attribute_uom_1,
    attribute_label_2: attributes.attribute_label_2,
    attribute_value_2: attributes.attribute_value_2,
    attribute_uom_2: attributes.attribute_uom_2,
    attribute_label_3: attributes.attribute_label_3,
    attribute_value_3: attributes.attribute_value_3,
    attribute_uom_3: attributes.attribute_uom_3,
    attribute_label_4: attributes.attribute_label_4,
    attribute_value_4: attributes.attribute_value_4,
    attribute_uom_4: attributes.attribute_uom_4,
    attribute_label_5: attributes.attribute_label_5,
    attribute_value_5: attributes.attribute_value_5,
    attribute_uom_5: attributes.attribute_uom_5,
    attribute_label_6: attributes.attribute_label_6,
    attribute_value_6: attributes.attribute_value_6,
    attribute_uom_6: attributes.attribute_uom_6,
    attribute_label_7: attributes.attribute_label_7,
    attribute_value_7: attributes.attribute_value_7,
    attribute_uom_7: attributes.attribute_uom_7,
    attribute_label_8: attributes.attribute_label_8,
    attribute_value_8: attributes.attribute_value_8,
    attribute_uom_8: attributes.attribute_uom_8,
    attribute_label_9: attributes.attribute_label_9,
    attribute_value_9: attributes.attribute_value_9,
    attribute_uom_9: attributes.attribute_uom_9,
    attribute_label_10: attributes.attribute_label_10,
    attribute_value_10: attributes.attribute_value_10,
    attribute_uom_10: attributes.attribute_uom_10,
    attribute_label_11: attributes.attribute_label_11,
    attribute_value_11: attributes.attribute_value_11,
    attribute_uom_11: attributes.attribute_uom_11,
    attribute_label_12: attributes.attribute_label_12,
    attribute_value_12: attributes.attribute_value_12,
    attribute_uom_12: attributes.attribute_uom_12,
    attribute_label_13: attributes.attribute_label_13,
    attribute_value_13: attributes.attribute_value_13,
    attribute_uom_13: attributes.attribute_uom_13,
    attribute_label_14: attributes.attribute_label_14,
    attribute_value_14: attributes.attribute_value_14,
    attribute_uom_14: attributes.attribute_uom_14,
    attribute_label_15: attributes.attribute_label_15,
    attribute_value_15: attributes.attribute_value_15,
    attribute_uom_15: attributes.attribute_uom_15,
    attribute_label_16: attributes.attribute_label_16,
    attribute_value_16: attributes.attribute_value_16,
    attribute_uom_16: attributes.attribute_uom_16,
    attribute_label_17: attributes.attribute_label_17,
    attribute_value_17: attributes.attribute_value_17,
    attribute_uom_17: attributes.attribute_uom_17,
    attribute_label_18: attributes.attribute_label_18,
    attribute_value_18: attributes.attribute_value_18,
    attribute_uom_18: attributes.attribute_uom_18,
    attribute_label_19: attributes.attribute_label_19,
    attribute_value_19: attributes.attribute_value_19,
    attribute_uom_19: attributes.attribute_uom_19,
    attribute_label_20: attributes.attribute_label_20,
    attribute_value_20: attributes.attribute_value_20,
    attribute_uom_20: attributes.attribute_uom_20,
    attribute_label_21: attributes.attribute_label_21,
    attribute_value_21: attributes.attribute_value_21,
    attribute_uom_21: attributes.attribute_uom_21,
    attribute_label_22: attributes.attribute_label_22,
    attribute_value_22: attributes.attribute_value_22,
    attribute_uom_22: attributes.attribute_uom_22,
    attribute_label_23: attributes.attribute_label_23,
    attribute_value_23: attributes.attribute_value_23,
    attribute_uom_23: attributes.attribute_uom_23,
    attribute_label_24: attributes.attribute_label_24,
    attribute_value_24: attributes.attribute_value_24,
    attribute_uom_24: attributes.attribute_uom_24,
    attribute_label_25: attributes.attribute_label_25,
    attribute_value_25: attributes.attribute_value_25,
    attribute_uom_25: attributes.attribute_uom_25,
    attribute_label_26: attributes.attribute_label_26,
    attribute_value_26: attributes.attribute_value_26,
    attribute_uom_26: attributes.attribute_uom_26,
    attribute_label_27: attributes.attribute_label_27,
    attribute_value_27: attributes.attribute_value_27,
    attribute_uom_27: attributes.attribute_uom_27,
    attribute_label_28: attributes.attribute_label_28,
    attribute_value_28: attributes.attribute_value_28,
    attribute_uom_28: attributes.attribute_uom_28,
    attribute_label_29: attributes.attribute_label_29,
    attribute_value_29: attributes.attribute_value_29,
    attribute_uom_29: attributes.attribute_uom_29,
    attribute_label_30: attributes.attribute_label_30,
    attribute_value_30: attributes.attribute_value_30,
    attribute_uom_30: attributes.attribute_uom_30,
    attribute_label_31: attributes.attribute_label_31,
    attribute_value_31: attributes.attribute_value_31,
    attribute_uom_31: attributes.attribute_uom_31,
    attribute_label_32: attributes.attribute_label_32,
    attribute_value_32: attributes.attribute_value_32,
    attribute_uom_32: attributes.attribute_uom_32,
    attribute_label_33: attributes.attribute_label_33,
    attribute_value_33: attributes.attribute_value_33,
    attribute_uom_33: attributes.attribute_uom_33,
    attribute_label_34: attributes.attribute_label_34,
    attribute_value_34: attributes.attribute_value_34,
    attribute_uom_34: attributes.attribute_uom_34,
    attribute_label_35: attributes.attribute_label_35,
    attribute_value_35: attributes.attribute_value_35,
    attribute_uom_35: attributes.attribute_uom_35,
    attribute_label_36: attributes.attribute_label_36,
    attribute_value_36: attributes.attribute_value_36,
    attribute_uom_36: attributes.attribute_uom_36,
    attribute_label_37: attributes.attribute_label_37,
    attribute_value_37: attributes.attribute_value_37,
    attribute_uom_37: attributes.attribute_uom_37,
    attribute_label_38: attributes.attribute_label_38,
    attribute_value_38: attributes.attribute_value_38,
    attribute_uom_38: attributes.attribute_uom_38,
    attribute_label_39: attributes.attribute_label_39,
    attribute_value_39: attributes.attribute_value_39,
    attribute_uom_39: attributes.attribute_uom_39,
    attribute_label_40: attributes.attribute_label_40,
    attribute_value_40: attributes.attribute_value_40,
    attribute_uom_40: attributes.attribute_uom_40,
    attribute_label_41: attributes.attribute_label_41,
    attribute_value_41: attributes.attribute_value_41,
    attribute_uom_41: attributes.attribute_uom_41,
    attribute_label_42: attributes.attribute_label_42,
    attribute_value_42: attributes.attribute_value_42,
    attribute_uom_42: attributes.attribute_uom_42,
    attribute_label_43: attributes.attribute_label_43,
    attribute_value_43: attributes.attribute_value_43,
    attribute_uom_43: attributes.attribute_uom_43,
    attribute_label_44: attributes.attribute_label_44,
    attribute_value_44: attributes.attribute_value_44,
    attribute_uom_44: attributes.attribute_uom_44,
    attribute_label_45: attributes.attribute_label_45,
    attribute_value_45: attributes.attribute_value_45,
    attribute_uom_45: attributes.attribute_uom_45,
    attribute_label_46: attributes.attribute_label_46,
    attribute_value_46: attributes.attribute_value_46,
    attribute_uom_46: attributes.attribute_uom_46,
    attribute_label_47: attributes.attribute_label_47,
    attribute_value_47: attributes.attribute_value_47,
    attribute_uom_47: attributes.attribute_uom_47,
    attribute_label_48: attributes.attribute_label_48,
    attribute_value_48: attributes.attribute_value_48,
    attribute_uom_48: attributes.attribute_uom_48,
    attribute_label_49: attributes.attribute_label_49,
    attribute_value_49: attributes.attribute_value_49,
    attribute_uom_49: attributes.attribute_uom_49,
    attribute_label_50: attributes.attribute_label_50,
    attribute_value_50: attributes.attribute_value_50,
    attribute_uom_50: attributes.attribute_uom_50,

    // Spec fields
    upc: product.upc,
    ean: product.ean,
    gtin: product.gtin,
    unspsc: product.unspsc,
    list_price: product.list_price,
    length: product.length,
    length_uom: product.length_uom,
    height: product.height,
    height_uom: product.height_uom,
    width: product.width,
    width_uom: product.width_uom,
    weight: product.weight,
    weight_uom: product.weight_uom,
    country_of_origin: product.country_of_origin,
    warranty: product.warranty,
    actual_image_flag: product.assets.some(
      (a: ProductAsset) => a.type === ProductAssetType.product_image && a.url
    ) ? 'Yes' : 'No',
  };

  return internalProduct;
}

// Export main types and functions for use by other modules
export { 
  normalizeString, 
  normalizeNumber, 
  normalizeBoolean, 
  normalizeFeature, 
  normalizeAttribute, 
  normalizeAsset,
  enrichItemToCanonical,
  mapSupabaseAssetType,
  canonicalToInternalFields 
};
export type { CanonicalProduct };