import { ProductCategory, ProductAttribute, Evidence } from '@/types';

export const BEARING_REQUIRED_ATTRIBUTES = [
  'bearing_type',
  'inner_diameter',
  'outer_diameter',
  'width',
  'dynamic_load_rating',
  'static_load_rating',
  'limiting_speed',
  'seal_type',
  'material',
  'manufacturer',
  'model',
] as const;

export const BEARING_OPTIONAL_ATTRIBUTES = [
  'lubrication',
  'temperature_range',
  'clearance',
  'application',
  'standard',
] as const;

export const BEARING_ALL_ATTRIBUTES = [
  ...BEARING_REQUIRED_ATTRIBUTES,
  ...BEARING_OPTIONAL_ATTRIBUTES,
] as const;

export type BearingRequiredAttribute = typeof BEARING_REQUIRED_ATTRIBUTES[number];
export type BearingOptionalAttribute = typeof BEARING_OPTIONAL_ATTRIBUTES[number];
export type BearingAttribute = typeof BEARING_ALL_ATTRIBUTES[number];

export const BEARING_ATTRIBUTE_LABELS: Record<BearingAttribute, string> = {
  bearing_type: 'Bearing Type',
  inner_diameter: 'Inner Diameter',
  outer_diameter: 'Outer Diameter',
  width: 'Width',
  dynamic_load_rating: 'Dynamic Load Rating',
  static_load_rating: 'Static Load Rating',
  limiting_speed: 'Limiting Speed',
  seal_type: 'Seal Type',
  material: 'Material',
  manufacturer: 'Manufacturer',
  model: 'Model',
  lubrication: 'Lubrication',
  temperature_range: 'Temperature Range',
  clearance: 'Clearance',
  application: 'Application',
  standard: 'Standard',
};

export const BEARING_ATTRIBUTE_UNITS: Record<BearingAttribute, string | null> = {
  bearing_type: null,
  inner_diameter: 'mm',
  outer_diameter: 'mm',
  width: 'mm',
  dynamic_load_rating: 'kN',
  static_load_rating: 'kN',
  limiting_speed: 'RPM',
  seal_type: null,
  material: null,
  manufacturer: null,
  model: null,
  lubrication: null,
  temperature_range: '°C',
  clearance: null,
  application: null,
  standard: null,
};

export function createBearingAttribute(
  key: BearingAttribute,
  value: string | number | null,
  unit: string | null,
  status: ProductAttribute['status'],
  confidence: number,
  evidence: Evidence[] = []
): ProductAttribute {
  return {
    key,
    label: BEARING_ATTRIBUTE_LABELS[key],
    value,
    unit,
    normalizedValue: value,
    normalizedUnit: unit,
    status,
    confidence,
    evidence,
  };
}

export const BEARING_CATEGORY: ProductCategory = 'bearing';