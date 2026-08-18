import { ProductCategory, ProductAttribute, Evidence } from '@/types';

export const PUMP_REQUIRED_ATTRIBUTES = [
  'pump_type',
  'flow_rate',
  'head',
  'power',
  'voltage',
  'frequency',
  'speed',
  'efficiency',
  'material',
  'manufacturer',
  'model',
] as const;

export const PUMP_OPTIONAL_ATTRIBUTES = [
  'inlet_size',
  'outlet_size',
  'temperature_range',
  'pressure',
  'application',
  'seal_type',
] as const;

export const PUMP_ALL_ATTRIBUTES = [
  ...PUMP_REQUIRED_ATTRIBUTES,
  ...PUMP_OPTIONAL_ATTRIBUTES,
] as const;

export type PumpRequiredAttribute = typeof PUMP_REQUIRED_ATTRIBUTES[number];
export type PumpOptionalAttribute = typeof PUMP_OPTIONAL_ATTRIBUTES[number];
export type PumpAttribute = typeof PUMP_ALL_ATTRIBUTES[number];

export const PUMP_ATTRIBUTE_LABELS: Record<PumpAttribute, string> = {
  pump_type: 'Pump Type',
  flow_rate: 'Flow Rate',
  head: 'Head',
  power: 'Power',
  voltage: 'Voltage',
  frequency: 'Frequency',
  speed: 'Speed',
  efficiency: 'Efficiency',
  material: 'Material',
  manufacturer: 'Manufacturer',
  model: 'Model',
  inlet_size: 'Inlet Size',
  outlet_size: 'Outlet Size',
  temperature_range: 'Temperature Range',
  pressure: 'Pressure',
  application: 'Application',
  seal_type: 'Seal Type',
};

export const PUMP_ATTRIBUTE_UNITS: Record<PumpAttribute, string | null> = {
  pump_type: null,
  flow_rate: 'm³/h',
  head: 'm',
  power: 'kW',
  voltage: 'V',
  frequency: 'Hz',
  speed: 'RPM',
  efficiency: '%',
  material: null,
  manufacturer: null,
  model: null,
  inlet_size: 'mm',
  outlet_size: 'mm',
  temperature_range: '°C',
  pressure: 'bar',
  application: null,
  seal_type: null,
};

export function createPumpAttribute(
  key: PumpAttribute,
  value: string | number | null,
  unit: string | null,
  status: ProductAttribute['status'],
  confidence: number,
  evidence: Evidence[] = []
): ProductAttribute {
  return {
    key,
    label: PUMP_ATTRIBUTE_LABELS[key],
    value,
    unit,
    normalizedValue: value,
    normalizedUnit: unit,
    status,
    confidence,
    evidence,
  };
}

export const PUMP_CATEGORY: ProductCategory = 'industrial_pump';