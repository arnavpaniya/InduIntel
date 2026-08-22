/**
 * Canonical Product Intelligence Core
 * 
 * CanonicalProduct type and utility functions for the product intelligence model.
 * This model is independent of the CSV/XLSX delivery format.
 */

import type { 
  CanonicalProduct, 
  ProductFieldProvenance, 
  ProductFieldStatus, 
  ProductFeature, 
  ProductAttribute, 
  ProductAsset 
} from '@/lib/product-intelligence/types';
import { ProductAssetType } from '@/lib/product-intelligence/types';

// ---- Default Values ----

const defaultStatus: Record<string, ProductFieldStatus> = {
  mfg_part_num: 'inferred',
  manufacturer_part_number: 'inferred',
  alternate_part_number: 'inferred',
  sku: 'inferred',
  trade_name: 'inferred',
  brand_name: 'inferred',
  manufacturer_name: 'inferred',
  product_name: 'inferred',
  dept: 'inferred',
  klass: 'inferred',
  fine: 'inferred',
  classpath: 'inferred',
  invoice_desc: 'inferred',
  mobile_desc: 'inferred',
  short_desc: 'inferred',
  long_desc1: 'inferred',
  retail_desc: 'inferred',
  marketing_description: 'inferred',
  upc: 'inferred',
  ean: 'inferred',
  gtin: 'inferred',
  unspsc: 'inferred',
  list_price: 'inferred',
  length: 'inferred',
  length_uom: 'inferred',
  width: 'inferred',
  width_uom: 'inferred',
  height: 'inferred',
  height_uom: 'inferred',
  weight: 'inferred',
  weight_uom: 'inferred',
  volume: 'inferred',
  volume_uom: 'inferred',
  country_of_origin: 'inferred',
  warranty: 'inferred',
  selling_qty: 'inferred',
  selling_uom: 'inferred',
  discontinued: 'inferred',
  standards_approvals: 'inferred',
  prop_65: 'inferred',
  application: 'inferred',
  includes: 'inferred',
  with: 'inferred',
};

/**
 * Create a new CanonicalProduct with default/empty values.
 * All string fields are null, numeric fields are 0/boolean false, arrays are empty,
 * provenance is undefined, and value_status uses defaults.
 */
export function createEmptyProduct(id: string): CanonicalProduct {
  return {
    id,
    mfg_part_num: null,
    manufacturer_part_number: null,
    alternate_part_number: null,
    sku: null,
    trade_name: null,
    brand_name: null,
    manufacturer_name: null,
    product_name: null,
    dept: null,
    klass: null,
    fine: null,
    classpath: null,
    part_desc: null,
    invoice_desc: null,
    mobile_desc: null,
    short_desc: null,
    long_desc1: null,
    retail_desc: null,
    marketing_description: null,
    features: [],
    attributes: [],
    upc: null,
    ean: null,
    gtin: null,
    unspsc: null,
    list_price: null,
    length: null,
    length_uom: null,
    width: null,
    width_uom: null,
    height: null,
    height_uom: null,
    weight: null,
    weight_uom: null,
    volume: null,
    volume_uom: null,
    country_of_origin: null,
    warranty: null,
    selling_qty: null,
    selling_uom: null,
    discontinued: null,
    standards_approvals: null,
    prop_65: null,
    application: null,
    includes: null,
    with: null,
    assets: [],
    value_status: { ...defaultStatus },
  };
}

/**
 * Set the value status for a specific field.
 * If status is provided, use it. Otherwise, default based on value presence.
 */
export function setFieldStatus(
  product: CanonicalProduct,
  field: keyof CanonicalProduct,
  status: ProductFieldStatus | undefined
): CanonicalProduct {
  const newStatus: Record<string, ProductFieldStatus> = { ...product.value_status };
  
  if (status !== undefined) {
    newStatus[field] = status;
  } else {
    // Default: if no explicit status, use 'inferred' for most fields
    // but 'verified' if it has a value (non-null, non-undefined, non-empty)
    const value = (product as any)[field];
    newStatus[field] = value != null && String(value).length > 0 ? 'verified' : 'inferred';
  }
  
  return {
    ...product,
    value_status: newStatus,
  };
}

/**
 * Add a provenance record to a specific field.
 */
export function addProvenance(
  product: CanonicalProduct,
  field: keyof CanonicalProduct,
  provenance: ProductFieldProvenance
): CanonicalProduct {
  const newStatus: Record<string, ProductFieldStatus> = { ...product.value_status };
  // Presence of provenance suggests 'inferred' or 'external' source
  newStatus[field] = 'inferred';
  
  return {
    ...product,
    value_status: newStatus,
  };
}

/**
 * Add a product feature with optional provenance.
 */
export function addFeature(
  product: CanonicalProduct,
  feature: Omit<ProductFeature, 'provenance'>,
  provenance?: ProductFieldProvenance
): CanonicalProduct {
  return {
    ...product,
    features: [...product.features, { ...feature, provenance }],
  };
}

/**
 * Add a dynamic attribute with optional provenance and normalized_value/uom/confidence.
 */
export function addAttribute(
  product: CanonicalProduct,
  attribute: Omit<ProductAttribute, 'provenance'>,
  provenance?: ProductFieldProvenance
): CanonicalProduct {
  return {
    ...product,
    attributes: [...product.attributes, { ...attribute, provenance }],
  };
}

/**
 * Add a product asset with explicit type.
 */
export function addAsset(
  product: CanonicalProduct,
  asset: Omit<ProductAsset, 'provenance'>,
  provenance?: ProductFieldProvenance
): CanonicalProduct {
  return {
    ...product,
    assets: [...product.assets, { ...asset, provenance }],
  };
}

/**
 * Convert a Supabase item + related records into a CanonicalProduct.
 * 
 * Reuses existing Supabase tables: items, item_descriptions, item_attributes,
 * item_specs, item_assets. Does not change database schema.
 */
export function transformSupabaseProductToCanonical(
  item: any,
  descriptions: any[],
  attributes: any[],
  specs: any | null,
  assets: any[]
): CanonicalProduct {
  let product = createEmptyProduct(item.id);

  // --- Identity ---
  product = setFieldStatus(product, 'mfg_part_num', item.mfg_part_num != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'manufacturer_part_number', item.alternate_part_number != null ? 'verified' : 'inferred');
  
  // Handle mfg_part_num / part_number / SKU mappings
  const partNumber = item.mfg_part_num || item.part_number || item.sku || null;
  if (partNumber !== null) {
    product = setFieldStatus(product, 'mfg_part_num', 'verified');
    // Also set as manufacturer_part_number if not separately set
    if (product.manufacturer_part_number == null) {
      product = { ...product, manufacturer_part_number: partNumber };
    }
  }
  
  product = setFieldStatus(product, 'alternate_part_number', item.alternate_part_number != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'sku', item.sku != null ? 'verified' : 'inferred');
  
  // Trade name, brand name, manufacturer name
  product = setFieldStatus(product, 'trade_name', item.trade_name != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'brand_name', item.brand_name != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'manufacturer_name', item.manufacturer_name != null ? 'verified' : 'inferred');
  
  // Product name
  product = setFieldStatus(product, 'product_name', item.product_name != null ? 'verified' : 'inferred');

  // --- Taxonomy ---
  product = setFieldStatus(product, 'dept', item.dept != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'klass', item.class != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'fine', item.fine != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'classpath', item.classpath != null ? 'verified' : 'inferred');

  // --- Descriptions ---
  // Extract the 5 description values from descriptions
  const byField = new Map(
    descriptions.map((d: any) => [d.field_name, d.value || ''])
  );
  
  product = setFieldStatus(product, 'invoice_desc', byField.get('invoice_desc') != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'mobile_desc', byField.get('mobile_desc') != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'short_desc', byField.get('short_desc') != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'long_desc1', byField.get('long_desc1') != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'retail_desc', byField.get('retail_desc') != null ? 'verified' : 'inferred');
  product = setFieldStatus(product, 'marketing_description', byField.get('marketing_description') != null ? 'verified' : 'inferred');

  // Apply description values
  if (byField.get('invoice_desc') !== undefined) {
    product = { ...product, invoice_desc: byField.get('invoice_desc') || null };
  }
  if (byField.get('mobile_desc') !== undefined) {
    product = { ...product, mobile_desc: byField.get('mobile_desc') || null };
  }
  if (byField.get('short_desc') !== undefined) {
    product = { ...product, short_desc: byField.get('short_desc') || null };
  }
  if (byField.get('long_desc1') !== undefined) {
    product = { ...product, long_desc1: byField.get('long_desc1') || null };
  }
  if (byField.get('retail_desc') !== undefined) {
    product = { ...product, retail_desc: byField.get('retail_desc') || null };
  }
  if (byField.get('marketing_description') !== undefined) {
    product = { ...product, marketing_description: byField.get('marketing_description') || null };
  }

  // --- Dynamic Features ---
  // Extract features from item_attributes or descriptions
  // Features are stored as attributes with specific labels
  const featureAttributes = attributes.filter((a: any) => 
    a.label && (a.label.startsWith('Feature') || a.label.startsWith('feature') || a.label.toLowerCase().includes('feature'))
  );
  
  // Build features from attributes
  const features: ProductFeature[] = [];
  for (const attr of featureAttributes.slice(0, 50)) {
    features.push({
      name: attr.label || 'feature',
      value: attr.value || '',
    });
  }
  
  // If no features found from attributes, try descriptions
  if (features.length === 0) {
    const descValues = descriptions
      .filter((d: any) => d.field_name === 'item_features')
      .map((d: any) => d.value);
    
    if (descValues.length > 0) {
      const featuresText = descValues[0];
      if (featuresText) {
        const featuresList = featuresText.split(';').map((f: string) => f.trim()).filter((f: string) => f);
        for (let i = 0; i < featuresList.length; i++) {
          features.push({
            name: `Feature ${i + 1}`,
            value: featuresList[i],
          });
        }
      }
    }
  }
  
  product = { ...product, features };

  // --- Dynamic Attributes ---
  // Extract all attributes from item_attributes
  const attrList: ProductAttribute[] = [];
  for (const attr of attributes) {
    attrList.push({
      label: attr.label || '',
      value: attr.value || '',
      uom: attr.uom,
    });
  }
  
  // If no attributes, add empty default
  if (attrList.length === 0) {
    attrList.push({
      label: '',
      value: '',
    });
  }
  
  product = { ...product, attributes: attrList };

  // --- Specifications ---
  if (specs) {
    product = setFieldStatus(product, 'upc', specs.upc != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'ean', specs.ean != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'gtin', specs.gtin != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'unspsc', specs.unspsc != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'list_price', specs.list_price != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'length', specs.length != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'length_uom', specs.length_uom != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'width', specs.width != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'width_uom', specs.width_uom != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'height', specs.height != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'height_uom', specs.height_uom != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'weight', specs.weight != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'weight_uom', specs.weight_uom != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'country_of_origin', specs.country_of_origin != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'warranty', specs.warranty != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'selling_qty', specs.selling_qty != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'selling_uom', specs.selling_uom != null ? 'verified' : 'inferred');
    product = setFieldStatus(product, 'discontinued', specs.discontinued != null ? 'verified' : 'inferred');

    // Apply spec values
    if (specs.upc !== undefined) product = { ...product, upc: specs.upc || null };
    if (specs.ean !== undefined) product = { ...product, ean: specs.ean || null };
    if (specs.gtin !== undefined) product = { ...product, gtin: specs.gtin || null };
    if (specs.unspsc !== undefined) product = { ...product, unspsc: specs.unspsc || null };
    if (specs.list_price !== undefined) product = { ...product, list_price: specs.list_price ?? null };
    if (specs.length !== undefined) product = { ...product, length: specs.length ?? null };
    if (specs.length_uom !== undefined) product = { ...product, length_uom: specs.length_uom || null };
    if (specs.width !== undefined) product = { ...product, width: specs.width ?? null };
    if (specs.width_uom !== undefined) product = { ...product, width_uom: specs.width_uom || null };
    if (specs.height !== undefined) product = { ...product, height: specs.height ?? null };
    if (specs.height_uom !== undefined) product = { ...product, height_uom: specs.height_uom || null };
    if (specs.weight !== undefined) product = { ...product, weight: specs.weight ?? null };
    if (specs.weight_uom !== undefined) product = { ...product, weight_uom: specs.weight_uom || null };
    if (specs.country_of_origin !== undefined) product = { ...product, country_of_origin: specs.country_of_origin || null };
    if (specs.warranty !== undefined) product = { ...product, warranty: specs.warranty || null };
    if (specs.selling_qty !== undefined) product = { ...product, selling_qty: specs.selling_qty ?? null };
    if (specs.selling_uom !== undefined) product = { ...product, selling_uom: specs.selling_uom || null };
    if (specs.discontinued !== undefined) product = { ...product, discontinued: specs.discontinued ?? null };
  } else {
    // Keep as null, status remains 'inferred'
  }

  // --- Assets ---
  const assetList: ProductAsset[] = [];
  for (const asset of assets || []) {
    let type: ProductAssetType;
    const assetType = asset.asset_type;
    
    // Map asset types
    switch (assetType) {
      case 'product_image':
        type = ProductAssetType.product_image;
        break;
      case 'spec_sheet':
      case 'specification_sheet':
        type = ProductAssetType.specification_sheet;
        break;
      case 'manual':
        type = ProductAssetType.instruction_manual;
        break;
      case 'mfr_url':
        type = ProductAssetType.manufacturer_url;
        break;
      case 'ref_url':
        type = ProductAssetType.reference_url;
        break;
      case 'SDS':
        type = ProductAssetType.SDS;
        break;
      case 'warranty_information':
        type = ProductAssetType.warranty_information;
        break;
      case 'catalog':
        type = ProductAssetType.catalog;
        break;
      case 'image_1':
      case 'image_2':
      case 'image_3':
      case 'image_4':
      case 'image_5':
        type = ProductAssetType.alternate_image;
        break;
      case 'technical_bulletin':
        type = ProductAssetType.technical_bulletin;
        break;
      case 'submittal':
        type = ProductAssetType.submittal;
        break;
      case 'compatibility_chart':
        type = ProductAssetType.compatibility_chart;
        break;
      case 'size_chart':
        type = ProductAssetType.size_chart;
        break;
      case 'product_label':
        type = ProductAssetType.product_label;
        break;
      case 'video':
        type = ProductAssetType.video;
        break;
      default:
        type = ProductAssetType.reference_url;
    }
    
    assetList.push({
      type,
      url: asset.url || '',
      title: asset.title,
    });
  }
  
  product = { ...product, assets: assetList };

  // --- Product Information ---
  // standards/approvals, Prop 65, application, includes, with
  // These can come from descriptions or specs; for now leave as default/null
  // The value_status stays as 'inferred' for these

  return product;
}