export * from './motor';
export * from './bearing';
export * from './pump';

import { ProductCategory } from '@/types';
import { MOTOR_ALL_ATTRIBUTES, MOTOR_REQUIRED_ATTRIBUTES, MOTOR_ATTRIBUTE_LABELS, MOTOR_ATTRIBUTE_UNITS } from './motor';
import { BEARING_ALL_ATTRIBUTES, BEARING_REQUIRED_ATTRIBUTES, BEARING_ATTRIBUTE_LABELS, BEARING_ATTRIBUTE_UNITS } from './bearing';
import { PUMP_ALL_ATTRIBUTES, PUMP_REQUIRED_ATTRIBUTES, PUMP_ATTRIBUTE_LABELS, PUMP_ATTRIBUTE_UNITS } from './pump';

export function getSchemaForCategory(category: ProductCategory) {
  switch (category) {
    case 'electric_motor':
      return {
        required: Array.from(MOTOR_REQUIRED_ATTRIBUTES),
        all: Array.from(MOTOR_ALL_ATTRIBUTES),
      };
    case 'bearing':
      return {
        required: Array.from(BEARING_REQUIRED_ATTRIBUTES),
        all: Array.from(BEARING_ALL_ATTRIBUTES),
      };
    case 'industrial_pump':
      return {
        required: Array.from(PUMP_REQUIRED_ATTRIBUTES),
        all: Array.from(PUMP_ALL_ATTRIBUTES),
      };
    default:
      return {
        required: [] as string[],
        all: [] as string[],
      };
  }
}

export function getRequiredAttributes(category: ProductCategory): string[] {
  return getSchemaForCategory(category).required;
}

export function getAllAttributes(category: ProductCategory): string[] {
  return getSchemaForCategory(category).all;
}

export function getAttributeLabel(category: ProductCategory, key: string): string {
  switch (category) {
    case 'electric_motor':
      return (MOTOR_ATTRIBUTE_LABELS as Record<string, string>)[key] || key;
    case 'bearing':
      return (BEARING_ATTRIBUTE_LABELS as Record<string, string>)[key] || key;
    case 'industrial_pump':
      return (PUMP_ATTRIBUTE_LABELS as Record<string, string>)[key] || key;
    default:
      return key;
  }
}

export function getAttributeUnit(category: ProductCategory, key: string): string | null {
  switch (category) {
    case 'electric_motor':
      return (MOTOR_ATTRIBUTE_UNITS as Record<string, string | null>)[key] ?? null;
    case 'bearing':
      return (BEARING_ATTRIBUTE_UNITS as Record<string, string | null>)[key] ?? null;
    case 'industrial_pump':
      return (PUMP_ATTRIBUTE_UNITS as Record<string, string | null>)[key] ?? null;
    default:
      return null;
  }
}