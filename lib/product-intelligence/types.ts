/**
 * Canonical Product Intelligence Types
 * 
 * Domain model for product intelligence independent of CSV/XLSX format.
 * The canonical model must NOT be designed around CSV column names.
 */

// ---- Provenance Model ----

export interface ProductFieldProvenance {
  source_type: 'input' | 'inferred' | 'manufacturer' | 'distributor' | 'external' | 'unknown';
  source_url?: string;
  source_title?: string;
  evidence?: string;
  confidence?: number;
  retrieved_at: Date;
}

// ---- Value Status ----

export type ProductFieldStatus =
  | 'verified'
  | 'inferred'
  | 'unresolved'
  | 'invalid'
  | 'conflicting';

// ---- Asset Type ----

export enum ProductAssetType {
  product_image = 'product_image',
  alternate_image = 'alternate_image',
  manufacturer_url = 'manufacturer_url',
  reference_url = 'reference_url',
  SDS = 'SDS',
  warranty_information = 'warranty_information',
  catalog = 'catalog',
  specification_sheet = 'specification_sheet',
  instruction_manual = 'instruction_manual',
  service_manual = 'service_manual',
  owners_manual = 'owners_manual',
  line_drawing = 'line_drawing',
  MTR = 'MTR',
  RoHS = 'RoHS',
  engineering_drawing = 'engineering_drawing',
  energy_star_guide = 'energy_star_guide',
  technical_bulletin = 'technical_bulletin',
  submittal = 'submittal',
  compatibility_chart = 'compatibility_chart',
  size_chart = 'size_chart',
  product_label = 'product_label',
  video = 'video',
}

export type ProductAssetTypeString =
  | ProductAssetType.product_image
  | ProductAssetType.alternate_image
  | ProductAssetType.manufacturer_url
  | ProductAssetType.reference_url
  | ProductAssetType.SDS
  | ProductAssetType.warranty_information
  | ProductAssetType.catalog
  | ProductAssetType.specification_sheet
  | ProductAssetType.instruction_manual
  | ProductAssetType.service_manual
  | ProductAssetType.owners_manual
  | ProductAssetType.line_drawing
  | ProductAssetType.MTR
  | ProductAssetType.RoHS
  | ProductAssetType.engineering_drawing
  | ProductAssetType.energy_star_guide
  | ProductAssetType.technical_bulletin
  | ProductAssetType.submittal
  | ProductAssetType.compatibility_chart
  | ProductAssetType.size_chart
  | ProductAssetType.product_label
  | ProductAssetType.video;

export interface ProductAsset {
  type: ProductAssetType;
  url: string;
  title?: string;
  provenance?: ProductFieldProvenance;
}

// ---- Dynamic Feature ----

export interface ProductFeature {
  name: string;
  value: string;
  provenance?: ProductFieldProvenance;
  status?: ProductFieldStatus;
}

// ---- Dynamic Attribute ----

export interface ProductAttribute {
  label: string;
  value: string;
  normalized_value?: string;
  uom?: string;
  confidence?: number;
  provenance?: ProductFieldProvenance;
  status?: ProductFieldStatus;
}

// ---- Canonical Product Intelligence Model ----

export interface CanonicalProduct {
  /** Unique product identifier */
  id: string;

  /** Identity fields */
  mfg_part_num: string | null;
  manufacturer_part_number: string | null;
  alternate_part_number: string | null;
  sku: string | null;
  trade_name: string | null;
  brand_name: string | null;
  manufacturer_name: string | null;
  product_name: string | null;

  /** Taxonomy */
  dept: string | null;
  klass: string | null;
  fine: string | null;
  classpath: string | null;

  /** Descriptions */
  invoice_desc: string | null;
  mobile_desc: string | null;
  short_desc: string | null;
  long_desc1: string | null;
  retail_desc: string | null;
  marketing_description: string | null;
  part_desc: string | null;  // Part/description field

  /** Dynamic features - arbitrary collection */
  features: ProductFeature[];

  /** Dynamic attributes - arbitrary number */
  attributes: ProductAttribute[];

  /** Specifications */
  upc: string | null;
  ean: string | null;
  gtin: string | null;
  unspsc: string | null;
  list_price: number | null;
  length: number | null;
  length_uom: string | null;
  width: number | null;
  width_uom: string | null;
  height: number | null;
  height_uom: string | null;
  weight: number | null;
  weight_uom: string | null;
  volume: number | null;
  volume_uom: string | null;
  country_of_origin: string | null;
  warranty: string | null;
  selling_qty: number | null;
  selling_uom: string | null;
  discontinued: boolean | null;

  /** Product information */
  standards_approvals: string | null;
  prop_65: boolean | null;
  application: string | null;
  includes: string | null;
  with: string | null;

  /** URLs/assets - dynamic collection */
  assets: ProductAsset[];

  /** Field-level value status tracking */
  value_status: Record<string, ProductFieldStatus>;
}