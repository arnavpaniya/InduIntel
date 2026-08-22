/**
 * Transform Supabase item result into InternalProductFields.
 * 
 * This extracts the necessary fields from the Supabase query result
 * (items + item_descriptions + item_attributes + item_specs + item_assets)
 * and maps them to the internal canonical fields used by the UniHack output mapper.
 */

import { 
  Item, 
  ItemDescription, 
  ItemAttribute, 
  ItemSpec, 
  EnrichedItem 
} from '@/lib/types';
import { 
  type InternalProductFields
} from '@/lib/unihack/output-mapper';
import type { CanonicalProduct } from '@/lib/product-intelligence/types';
import { 
  transformSupabaseProductToCanonical 
} from '@/lib/product-intelligence/canonical';
import { 
  UNIHACK_HEADERS, 
  HEADER_TO_INTERNAL, 
  TOTAL_HEADERS 
} from '@/lib/unihack/output-mapper';

/**
 * Extract the 5 description values from item_descriptions by field_name.
 * Returns an object with field_name as key and value as string.
 */
function extractDescriptions(descriptions: ItemDescription[]): {
  invoice_desc: string | null;
  mobile_desc: string | null;
  short_desc: string | null;
  long_desc1: string | null;
  marketing_description: string | null;
  retail_desc: string | null;
} {
  const byField = new Map(
    descriptions.map(d => [d.field_name, d.value || ''])
  );

  return {
    invoice_desc: byField.get('invoice_desc') ?? null,
    mobile_desc: byField.get('mobile_desc') ?? null,
    short_desc: byField.get('short_desc') ?? null,
    long_desc1: byField.get('long_desc1') ?? null,
    marketing_description: byField.get('marketing_description') ?? null,
    retail_desc: byField.get('retail_desc') ?? null,
  };
}

/**
 * Extract up to 50 attributes from item_attributes, indexed by seq.
 * Returns objects with attribute_label_1 through attribute_label_50,
 * attribute_value_1 through attribute_value_50, and attribute_uom_1 through attribute_uom_50.
 */
function extractAttributes(attributes: ItemAttribute[]): {
  attribute_label_1: string | null; attribute_value_1: string | null; attribute_uom_1: string | null;
  attribute_label_2: string | null; attribute_value_2: string | null; attribute_uom_2: string | null;
  attribute_label_3: string | null; attribute_value_3: string | null; attribute_uom_3: string | null;
  attribute_label_4: string | null; attribute_value_4: string | null; attribute_uom_4: string | null;
  attribute_label_5: string | null; attribute_value_5: string | null; attribute_uom_5: string | null;
  attribute_label_6: string | null; attribute_value_6: string | null; attribute_uom_6: string | null;
  attribute_label_7: string | null; attribute_value_7: string | null; attribute_uom_7: string | null;
  attribute_label_8: string | null; attribute_value_8: string | null; attribute_uom_8: string | null;
  attribute_label_9: string | null; attribute_value_9: string | null; attribute_uom_9: string | null;
  attribute_label_10: string | null; attribute_value_10: string | null; attribute_uom_10: string | null;
  attribute_label_11: string | null; attribute_value_11: string | null; attribute_uom_11: string | null;
  attribute_label_12: string | null; attribute_value_12: string | null; attribute_uom_12: string | null;
  attribute_label_13: string | null; attribute_value_13: string | null; attribute_uom_13: string | null;
  attribute_label_14: string | null; attribute_value_14: string | null; attribute_uom_14: string | null;
  attribute_label_15: string | null; attribute_value_15: string | null; attribute_uom_15: string | null;
  attribute_label_16: string | null; attribute_value_16: string | null; attribute_uom_16: string | null;
  attribute_label_17: string | null; attribute_value_17: string | null; attribute_uom_17: string | null;
  attribute_label_18: string | null; attribute_value_18: string | null; attribute_uom_18: string | null;
  attribute_label_19: string | null; attribute_value_19: string | null; attribute_uom_19: string | null;
  attribute_label_20: string | null; attribute_value_20: string | null; attribute_uom_20: string | null;
  attribute_label_21: string | null; attribute_value_21: string | null; attribute_uom_21: string | null;
  attribute_label_22: string | null; attribute_value_22: string | null; attribute_uom_22: string | null;
  attribute_label_23: string | null; attribute_value_23: string | null; attribute_uom_23: string | null;
  attribute_label_24: string | null; attribute_value_24: string | null; attribute_uom_24: string | null;
  attribute_label_25: string | null; attribute_value_25: string | null; attribute_uom_25: string | null;
  attribute_label_26: string | null; attribute_value_26: string | null; attribute_uom_26: string | null;
  attribute_label_27: string | null; attribute_value_27: string | null; attribute_uom_27: string | null;
  attribute_label_28: string | null; attribute_value_28: string | null; attribute_uom_28: string | null;
  attribute_label_29: string | null; attribute_value_29: string | null; attribute_uom_29: string | null;
  attribute_label_30: string | null; attribute_value_30: string | null; attribute_uom_30: string | null;
  attribute_label_31: string | null; attribute_value_31: string | null; attribute_uom_31: string | null;
  attribute_label_32: string | null; attribute_value_32: string | null; attribute_uom_32: string | null;
  attribute_label_33: string | null; attribute_value_33: string | null; attribute_uom_33: string | null;
  attribute_label_34: string | null; attribute_value_34: string | null; attribute_uom_34: string | null;
  attribute_label_35: string | null; attribute_value_35: string | null; attribute_uom_35: string | null;
  attribute_label_36: string | null; attribute_value_36: string | null; attribute_uom_36: string | null;
  attribute_label_37: string | null; attribute_value_37: string | null; attribute_uom_37: string | null;
  attribute_label_38: string | null; attribute_value_38: string | null; attribute_uom_38: string | null;
  attribute_label_39: string | null; attribute_value_39: string | null; attribute_uom_39: string | null;
  attribute_label_40: string | null; attribute_value_40: string | null; attribute_uom_40: string | null;
  attribute_label_41: string | null; attribute_value_41: string | null; attribute_uom_41: string | null;
  attribute_label_42: string | null; attribute_value_42: string | null; attribute_uom_42: string | null;
  attribute_label_43: string | null; attribute_value_43: string | null; attribute_uom_43: string | null;
  attribute_label_44: string | null; attribute_value_44: string | null; attribute_uom_44: string | null;
  attribute_label_45: string | null; attribute_value_45: string | null; attribute_uom_45: string | null;
  attribute_label_46: string | null; attribute_value_46: string | null; attribute_uom_46: string | null;
  attribute_label_47: string | null; attribute_value_47: string | null; attribute_uom_47: string | null;
  attribute_label_48: string | null; attribute_value_48: string | null; attribute_uom_48: string | null;
  attribute_label_49: string | null; attribute_value_49: string | null; attribute_uom_49: string | null;
  attribute_label_50: string | null; attribute_value_50: string | null; attribute_uom_50: string | null;
} {
  // Initialize all to null
  const result: any = {};

  // Initialize all 50 attributes to null
  for (let i = 1; i <= 50; i++) {
    result[`attribute_label_${i}`] = null;
    result[`attribute_value_${i}`] = null;
    result[`attribute_uom_${i}`] = null;
  }

  // Fill in from actual attributes
  for (const attr of attributes) {
    const seq = attr.seq;
    if (seq >= 1 && seq <= 50) {
      result[`attribute_label_${seq}`] = attr.label || null;
      result[`attribute_value_${seq}`] = attr.value || null;
      result[`attribute_uom_${seq}`] = attr.uom || null;
    }
  }

  return result as ReturnType<typeof extractAttributes>;
}

/** Extract spec fields from item_specs */
function extractSpecs(specs: ItemSpec | null): {
  upc: string | null; ean: string | null; gtin: string | null; unspsc: string | null;
  list_price: number | null; length: number | null; length_uom: string | null;
  height: number | null; height_uom: string | null; width: number | null; width_uom: string | null;
  weight: number | null; weight_uom: string | null; country_of_origin: string | null; warranty: string | null;
} {
  if (!specs) {
    return {
      upc: null, ean: null, gtin: null, unspsc: null,
      list_price: null, length: null, length_uom: null,
      height: null, height_uom: null, width: null, width_uom: null,
      weight: null, weight_uom: null, country_of_origin: null, warranty: null,
    };
  }

  return {
    upc: specs.upc || null,
    ean: specs.ean || null,
    gtin: specs.gtin || null,
    unspsc: specs.unspsc || null,
    list_price: specs.list_price ?? null,
    length: specs.length ?? null,
    length_uom: specs.length_uom ?? null,
    height: specs.height ?? null,
    height_uom: specs.height_uom ?? null,
    width: specs.width ?? null,
    width_uom: specs.width_uom ?? null,
    weight: specs.weight ?? null,
    weight_uom: specs.weight_uom ?? null,
    country_of_origin: specs.country_of_origin || null,
    warranty: specs.warranty || null,
  };
}

/** Extract asset flag for product image */
function extractImageFlag(assets: any[]): string {
  if (!assets || assets.length === 0) return 'No';
  const productImage = assets.find((a: any) => a.asset_type === 'product_image' && a.url);
  return productImage ? 'Yes' : 'No';
}

/**
 * Transform a Supabase-enriched item into InternalProductFields.
 * 
 * The Supabase query result has items with relations:
 * - item_descriptions: ItemDescription[]
 * - item_attributes: ItemAttribute[]  
 * - item_specs: ItemSpec[]
 * - item_assets: { asset_type: string; url: string }[] (may not be in select)
 */
function transformItemToInternal(
  item: any,
  descriptions: ItemDescription[],
  attributes: ItemAttribute[],
  specs: ItemSpec | null,
  assets: any[]
): InternalProductFields {
  // Extract descriptions
  const descs = extractDescriptions(descriptions);

  // Extract attributes
  const attrs = extractAttributes(attributes);

  // Extract specs
  const specFields = extractSpecs(specs);

  // Extract image flag
  const imageFlag = extractImageFlag(assets || []);

  return {
    // Core item fields
    mfg_part_num: item.mfg_part_num ?? null,
    part_desc: item.part_desc ?? null,
    e1_brand: item.e1_brand ?? null,
    unilog_brand: item.unilog_brand ?? null,
    dib_brand: item.dib_brand ?? null,
    part_manuf: item.part_manuf ?? null,
    manufacturer_name: item.manufacturer_name ?? null,
    brand_name: item.brand_name ?? null,
    trade_name: item.trade_name ?? null,
    alternate_part_number: item.alternate_part_number ?? null,
    dept: item.dept ?? null,
    klass: item.class ?? null, // class is reserved, stored as klass internally
    fine: item.fine ?? null,
    classpath: item.classpath ?? null,
    mfg_part_num_for_features: item.part_desc ?? null, // alias for part_desc for features

    // Descriptions
    mobile_desc: descs.mobile_desc ?? null,
    invoice_desc: descs.invoice_desc ?? null,
    short_desc: descs.short_desc ?? null,
    long_desc1: descs.long_desc1 ?? null,
    retail_desc: descs.retail_desc ?? null,
    marketing_description: descs.marketing_description ?? null,

    // ITEM_FEATURES_1 through ITEM_FEATURES_20
    // These are derived from item_features field in descriptions or attributes
    item_features_1: attrs.attribute_value_1 ?? null,
    item_features_2: attrs.attribute_value_2 ?? null,
    item_features_3: attrs.attribute_value_3 ?? null,
    item_features_4: attrs.attribute_value_4 ?? null,
    item_features_5: attrs.attribute_value_5 ?? null,
    item_features_6: attrs.attribute_value_6 ?? null,
    item_features_7: attrs.attribute_value_7 ?? null,
    item_features_8: attrs.attribute_value_8 ?? null,
    item_features_9: attrs.attribute_value_9 ?? null,
    item_features_10: attrs.attribute_value_10 ?? null,
    item_features_11: attrs.attribute_value_11 ?? null,
    item_features_12: attrs.attribute_value_12 ?? null,
    item_features_13: attrs.attribute_value_13 ?? null,
    item_features_14: attrs.attribute_value_14 ?? null,
    item_features_15: attrs.attribute_value_15 ?? null,
    item_features_16: attrs.attribute_value_16 ?? null,
    item_features_17: attrs.attribute_value_17 ?? null,
    item_features_18: attrs.attribute_value_18 ?? null,
    item_features_19: attrs.attribute_value_19 ?? null,
    item_features_20: attrs.attribute_value_20 ?? null,

    // Attributes (label/value/uom 1-50)
    attribute_label_1: attrs.attribute_label_1,
    attribute_value_1: attrs.attribute_value_1,
    attribute_uom_1: attrs.attribute_uom_1,
    attribute_label_2: attrs.attribute_label_2,
    attribute_value_2: attrs.attribute_value_2,
    attribute_uom_2: attrs.attribute_uom_2,
    attribute_label_3: attrs.attribute_label_3,
    attribute_value_3: attrs.attribute_value_3,
    attribute_uom_3: attrs.attribute_uom_3,
    attribute_label_4: attrs.attribute_label_4,
    attribute_value_4: attrs.attribute_value_4,
    attribute_uom_4: attrs.attribute_uom_4,
    attribute_label_5: attrs.attribute_label_5,
    attribute_value_5: attrs.attribute_value_5,
    attribute_uom_5: attrs.attribute_uom_5,
    attribute_label_6: attrs.attribute_label_6,
    attribute_value_6: attrs.attribute_value_6,
    attribute_uom_6: attrs.attribute_uom_6,
    attribute_label_7: attrs.attribute_label_7,
    attribute_value_7: attrs.attribute_value_7,
    attribute_uom_7: attrs.attribute_uom_7,
    attribute_label_8: attrs.attribute_label_8,
    attribute_value_8: attrs.attribute_value_8,
    attribute_uom_8: attrs.attribute_uom_8,
    attribute_label_9: attrs.attribute_label_9,
    attribute_value_9: attrs.attribute_value_9,
    attribute_uom_9: attrs.attribute_uom_9,
    attribute_label_10: attrs.attribute_label_10,
    attribute_value_10: attrs.attribute_value_10,
    attribute_uom_10: attrs.attribute_uom_10,
    attribute_label_11: attrs.attribute_label_11,
    attribute_value_11: attrs.attribute_value_11,
    attribute_uom_11: attrs.attribute_uom_11,
    attribute_label_12: attrs.attribute_label_12,
    attribute_value_12: attrs.attribute_value_12,
    attribute_uom_12: attrs.attribute_uom_12,
    attribute_label_13: attrs.attribute_label_13,
    attribute_value_13: attrs.attribute_value_13,
    attribute_uom_13: attrs.attribute_uom_13,
    attribute_label_14: attrs.attribute_label_14,
    attribute_value_14: attrs.attribute_value_14,
    attribute_uom_14: attrs.attribute_uom_14,
    attribute_label_15: attrs.attribute_label_15,
    attribute_value_15: attrs.attribute_value_15,
    attribute_uom_15: attrs.attribute_uom_15,
    attribute_label_16: attrs.attribute_label_16,
    attribute_value_16: attrs.attribute_value_16,
    attribute_uom_16: attrs.attribute_uom_16,
    attribute_label_17: attrs.attribute_label_17,
    attribute_value_17: attrs.attribute_value_17,
    attribute_uom_17: attrs.attribute_uom_17,
    attribute_label_18: attrs.attribute_label_18,
    attribute_value_18: attrs.attribute_value_18,
    attribute_uom_18: attrs.attribute_uom_18,
    attribute_label_19: attrs.attribute_label_19,
    attribute_value_19: attrs.attribute_value_19,
    attribute_uom_19: attrs.attribute_uom_19,
    attribute_label_20: attrs.attribute_label_20,
    attribute_value_20: attrs.attribute_value_20,
    attribute_uom_20: attrs.attribute_uom_20,
    attribute_label_21: attrs.attribute_label_21,
    attribute_value_21: attrs.attribute_value_21,
    attribute_uom_21: attrs.attribute_uom_21,
    attribute_label_22: attrs.attribute_label_22,
    attribute_value_22: attrs.attribute_value_22,
    attribute_uom_22: attrs.attribute_uom_22,
    attribute_label_23: attrs.attribute_label_23,
    attribute_value_23: attrs.attribute_value_23,
    attribute_uom_23: attrs.attribute_uom_23,
    attribute_label_24: attrs.attribute_label_24,
    attribute_value_24: attrs.attribute_value_24,
    attribute_uom_24: attrs.attribute_uom_24,
    attribute_label_25: attrs.attribute_label_25,
    attribute_value_25: attrs.attribute_value_25,
    attribute_uom_25: attrs.attribute_uom_25,
    attribute_label_26: attrs.attribute_label_26,
    attribute_value_26: attrs.attribute_value_26,
    attribute_uom_26: attrs.attribute_uom_26,
    attribute_label_27: attrs.attribute_label_27,
    attribute_value_27: attrs.attribute_value_27,
    attribute_uom_27: attrs.attribute_uom_27,
    attribute_label_28: attrs.attribute_label_28,
    attribute_value_28: attrs.attribute_value_28,
    attribute_uom_28: attrs.attribute_uom_28,
    attribute_label_29: attrs.attribute_label_29,
    attribute_value_29: attrs.attribute_value_29,
    attribute_uom_29: attrs.attribute_uom_29,
    attribute_label_30: attrs.attribute_label_30,
    attribute_value_30: attrs.attribute_value_30,
    attribute_uom_30: attrs.attribute_uom_30,
    attribute_label_31: attrs.attribute_label_31,
    attribute_value_31: attrs.attribute_value_31,
    attribute_uom_31: attrs.attribute_uom_31,
    attribute_label_32: attrs.attribute_label_32,
    attribute_value_32: attrs.attribute_value_32,
    attribute_uom_32: attrs.attribute_uom_32,
    attribute_label_33: attrs.attribute_label_33,
    attribute_value_33: attrs.attribute_value_33,
    attribute_uom_33: attrs.attribute_uom_33,
    attribute_label_34: attrs.attribute_label_34,
    attribute_value_34: attrs.attribute_value_34,
    attribute_uom_34: attrs.attribute_uom_34,
    attribute_label_35: attrs.attribute_label_35,
    attribute_value_35: attrs.attribute_value_35,
    attribute_uom_35: attrs.attribute_uom_35,
    attribute_label_36: attrs.attribute_label_36,
    attribute_value_36: attrs.attribute_value_36,
    attribute_uom_36: attrs.attribute_uom_36,
    attribute_label_37: attrs.attribute_label_37,
    attribute_value_37: attrs.attribute_value_37,
    attribute_uom_37: attrs.attribute_uom_37,
    attribute_label_38: attrs.attribute_label_38,
    attribute_value_38: attrs.attribute_value_38,
    attribute_uom_38: attrs.attribute_uom_38,
    attribute_label_39: attrs.attribute_label_39,
    attribute_value_39: attrs.attribute_value_39,
    attribute_uom_39: attrs.attribute_uom_39,
    attribute_label_40: attrs.attribute_label_40,
    attribute_value_40: attrs.attribute_value_40,
    attribute_uom_40: attrs.attribute_uom_40,
    attribute_label_41: attrs.attribute_label_41,
    attribute_value_41: attrs.attribute_value_41,
    attribute_uom_41: attrs.attribute_uom_41,
    attribute_label_42: attrs.attribute_label_42,
    attribute_value_42: attrs.attribute_value_42,
    attribute_uom_42: attrs.attribute_uom_42,
    attribute_label_43: attrs.attribute_label_43,
    attribute_value_43: attrs.attribute_value_43,
    attribute_uom_43: attrs.attribute_uom_43,
    attribute_label_44: attrs.attribute_label_44,
    attribute_value_44: attrs.attribute_value_44,
    attribute_uom_44: attrs.attribute_uom_44,
    attribute_label_45: attrs.attribute_label_45,
    attribute_value_45: attrs.attribute_value_45,
    attribute_uom_45: attrs.attribute_uom_45,
    attribute_label_46: attrs.attribute_label_46,
    attribute_value_46: attrs.attribute_value_46,
    attribute_uom_46: attrs.attribute_uom_46,
    attribute_label_47: attrs.attribute_label_47,
    attribute_value_47: attrs.attribute_value_47,
    attribute_uom_47: attrs.attribute_uom_47,
    attribute_label_48: attrs.attribute_label_48,
    attribute_value_48: attrs.attribute_value_48,
    attribute_uom_48: attrs.attribute_uom_48,
    attribute_label_49: attrs.attribute_label_49,
    attribute_value_49: attrs.attribute_value_49,
    attribute_uom_49: attrs.attribute_uom_49,
    attribute_label_50: attrs.attribute_label_50,
    attribute_value_50: attrs.attribute_value_50,
    attribute_uom_50: attrs.attribute_uom_50,

    // Spec fields
    upc: specFields.upc,
    ean: specFields.ean,
    gtin: specFields.gtin,
    unspsc: specFields.unspsc,
    list_price: specFields.list_price,
    length: specFields.length,
    length_uom: specFields.length_uom,
    height: specFields.height,
    height_uom: specFields.height_uom,
    width: specFields.width,
    width_uom: specFields.width_uom,
    weight: specFields.weight,
    weight_uom: specFields.weight_uom,
    country_of_origin: specFields.country_of_origin,
    warranty: specFields.warranty,

    // Actual image flag
    actual_image_flag: imageFlag,
  };
}

/**
 * Transform a Supabase-enriched item into CanonicalProduct.
 * 
 * This extracts the necessary fields from the Supabase query result
 * (items + item_descriptions + item_attributes + item_specs + item_assets)
 * and maps them to the canonical Product Intelligence model.
 * 
 * The canonical model is independent of the CSV/XLSX delivery format.
 */
function transformItemToCanonical(
  item: any,
  descriptions: ItemDescription[],
  attributes: ItemAttribute[],
  specs: ItemSpec | null,
  assets: any[]
): CanonicalProduct {
  return transformSupabaseProductToCanonical(item, descriptions, attributes, specs, assets);
}

export { transformItemToInternal, transformItemToCanonical };