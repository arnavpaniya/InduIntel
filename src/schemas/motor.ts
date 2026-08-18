import { ProductCategory, ProductAttribute, Evidence } from '@/types';

export const MOTOR_REQUIRED_ATTRIBUTES = [
  'power',
  'voltage',
  'current',
  'frequency',
  'phase',
  'speed',
  'efficiency',
  'efficiency_class',
  'ip_rating',
  'frame_size',
  'mounting',
  'insulation_class',
  'duty',
  'ambient_temperature',
  'rated_torque',
  'manufacturer',
  'model',
] as const;

export const MOTOR_OPTIONAL_ATTRIBUTES = [
  'dimensions',
  'weight',
  'material',
  'application',
  'standards',
  'certification',
] as const;

export const MOTOR_ALL_ATTRIBUTES = [
  ...MOTOR_REQUIRED_ATTRIBUTES,
  ...MOTOR_OPTIONAL_ATTRIBUTES,
] as const;

export type MotorRequiredAttribute = typeof MOTOR_REQUIRED_ATTRIBUTES[number];
export type MotorOptionalAttribute = typeof MOTOR_OPTIONAL_ATTRIBUTES[number];
export type MotorAttribute = typeof MOTOR_ALL_ATTRIBUTES[number];

export const MOTOR_ATTRIBUTE_LABELS: Record<MotorAttribute, string> = {
  power: 'Power',
  voltage: 'Voltage',
  current: 'Current',
  frequency: 'Frequency',
  phase: 'Phase',
  speed: 'Speed',
  efficiency: 'Efficiency',
  efficiency_class: 'Efficiency Class',
  ip_rating: 'IP Rating',
  frame_size: 'Frame Size',
  mounting: 'Mounting',
  insulation_class: 'Insulation Class',
  duty: 'Duty',
  ambient_temperature: 'Ambient Temperature',
  rated_torque: 'Rated Torque',
  manufacturer: 'Manufacturer',
  model: 'Model',
  dimensions: 'Dimensions',
  weight: 'Weight',
  material: 'Material',
  application: 'Application',
  standards: 'Standards',
  certification: 'Certification',
};

export const MOTOR_ATTRIBUTE_UNITS: Record<MotorAttribute, string | null> = {
  power: 'HP',
  voltage: 'V',
  current: 'A',
  frequency: 'Hz',
  phase: null,
  speed: 'RPM',
  efficiency: '%',
  efficiency_class: null,
  ip_rating: null,
  frame_size: null,
  mounting: null,
  insulation_class: null,
  duty: null,
  ambient_temperature: '°C',
  rated_torque: 'Nm',
  manufacturer: null,
  model: null,
  dimensions: 'mm',
  weight: 'kg',
  material: null,
  application: null,
  standards: null,
  certification: null,
};

export function createMotorAttribute(
  key: MotorAttribute,
  value: string | number | null,
  unit: string | null,
  status: ProductAttribute['status'],
  confidence: number,
  evidence: Evidence[] = []
): ProductAttribute {
  return {
    key,
    label: MOTOR_ATTRIBUTE_LABELS[key],
    value,
    unit,
    normalizedValue: value,
    normalizedUnit: unit,
    status,
    confidence,
    evidence,
  };
}

export const MOTOR_CATEGORY: ProductCategory = 'electric_motor';