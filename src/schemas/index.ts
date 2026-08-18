export * from './motor';
export * from './bearing';
export * from './pump';

import { ProductCategory } from '@/types';
import { MOTOR_ALL_ATTRIBUTES, MOTOR_REQUIRED_ATTRIBUTES } from './motor';
import { BEARING_ALL_ATTRIBUTES, BEARING_REQUIRED_ATTRIBUTES } from './bearing';
import { PUMP_ALL_ATTRIBUTES, PUMP_REQUIRED_ATTRIBUTES } from './pump';

export function getSchemaForCategory(category: ProductCategory) {
  switch (category) {
    case 'electric_motor':
      return {
        required: MOTOR_REQUIRED_ATTRIBUTES,
        all: MOTOR_ALL_ATTRIBUTES,
      };
    case 'bearing':
      return {
        required: BEARING_REQUIRED_ATTRIBUTES,
        all: BEARING_ALL_ATTRIBUTES,
      };
    case 'industrial_pump':
      return {
        required: PUMP_REQUIRED_ATTRIBUTES,
        all: PUMP_ALL_ATTRIBUTES,
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
      return (await import('./motor')).MOTOR_ATTRIBUTE_LABELS[key as any] || key;
    case 'bearing':
      return (await import('./bearing')).BEARING_ATTRIBUTE_LABELS[key as any] || key;
    case 'industrial_pump':
      return (await import('./pump')).PUMP_ATTRIBUTE_LABELS[key as any] || key;
    default:
      return key;
  }
}

export function getAttributeUnit(category: ProductCategory, key: string): string | null {
  switch (category) {
    case 'electric_motor':
      return (await import('./motor')).MOTOR_ATTRIBUTE_UNITS[key as any] || null;
    case 'bearing':
      return (await import('./bearing')).BEARING_ATTRIBUTE_UNITS[key as any] || null;
    case 'industrial_pump':
      return (await import('./pump')).PUMP_ATTRIBUTE_UNITS[key as any] || null;
    default:
      return null;
  }
}