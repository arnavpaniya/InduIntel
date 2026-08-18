export interface NormalizedValue {
  value: number | string | null;
  unit: string | null;
  originalValue: string | number | null;
  originalUnit: string | null;
}

const UNIT_ALIASES: Record<string, string> = {
  // Power
  'hp': 'HP',
  'horsepower': 'HP',
  'kw': 'kW',
  'kilowatt': 'kW',
  'w': 'W',
  'watt': 'W',

  // Voltage
  'v': 'V',
  'volt': 'V',
  'kv': 'kV',
  'kilovolt': 'kV',

  // Current
  'a': 'A',
  'amp': 'A',
  'ampere': 'A',
  'ma': 'mA',
  'milliampere': 'mA',

  // Frequency
  'hz': 'Hz',
  'hertz': 'Hz',
  'khz': 'kHz',

  // Speed
  'rpm': 'RPM',
  'rev/min': 'RPM',
  'r/min': 'RPM',

  // Temperature
  'c': '°C',
  'celsius': '°C',
  'degc': '°C',
  'f': '°F',
  'fahrenheit': '°F',
  'degf': '°F',
  'k': 'K',
  'kelvin': 'K',

  // Torque
  'nm': 'Nm',
  'newtonmeter': 'Nm',
  'newton-meter': 'Nm',
  'n-m': 'Nm',
  'kgm': 'kgm',
  'kg-m': 'kgm',
  'ftlb': 'ft-lb',
  'ft-lb': 'ft-lb',

  // Pressure
  'bar': 'bar',
  'mpa': 'MPa',
  'psi': 'psi',
  'kpa': 'kPa',

  // Flow
  'm3/h': 'm³/h',
  'm3/hr': 'm³/h',
  'cubic meter per hour': 'm³/h',
  'l/min': 'L/min',
  'lpm': 'L/min',
  'gpm': 'GPM',

  // Head
  'm': 'm',
  'meter': 'm',
  'meters': 'm',
  'ft': 'ft',
  'feet': 'ft',

  // Efficiency
  '%': '%',
  'percent': '%',

  // Dimensions
  'mm': 'mm',
  'millimeter': 'mm',
  'cm': 'cm',
  'centimeter': 'cm',
  'in': 'in',
  'inch': 'in',
  'inches': 'in',

  // Weight
  'kg': 'kg',
  'kilogram': 'kg',
  'g': 'g',
  'gram': 'g',
  'lb': 'lb',
  'lbs': 'lb',
  'pound': 'lb',

  // Load ratings
  'kn': 'kN',
  'kilonewton': 'kN',
  'n': 'N',
  'newton': 'N',
};

interface ConversionRule {
  to: string;
  factor: number;
  offset?: number;
  multiply?: number;
}

const UNIT_CONVERSIONS: Record<string, ConversionRule[]> = {
  // Power conversions to kW
  'HP': [{ to: 'kW', factor: 0.7457 }],
  'W': [{ to: 'kW', factor: 0.001 }],
  'kW': [],

  // Voltage conversions to V
  'V': [],
  'kV': [{ to: 'V', factor: 1000 }],

  // Current conversions to A
  'A': [],
  'mA': [{ to: 'A', factor: 0.001 }],

  // Speed - no conversion, keep RPM

  // Temperature conversions to °C
  '°C': [],
  '°F': [{ to: '°C', factor: 1, offset: -32, multiply: 5 / 9 }],
  'K': [{ to: '°C', factor: 1, offset: -273.15 }],

  // Torque conversions to Nm
  'Nm': [],
  'kgm': [{ to: 'Nm', factor: 9.80665 }],
  'ft-lb': [{ to: 'Nm', factor: 1.35582 }],

  // Pressure conversions to bar
  'bar': [],
  'MPa': [{ to: 'bar', factor: 10 }],
  'kPa': [{ to: 'bar', factor: 0.01 }],
  'psi': [{ to: 'bar', factor: 0.0689476 }],

  // Flow conversions to m³/h
  'm³/h': [],
  'L/min': [{ to: 'm³/h', factor: 0.06 }],
  'GPM': [{ to: 'm³/h', factor: 0.227125 }],

  // Head conversions to m
  'm': [],
  'ft': [{ to: 'm', factor: 0.3048 }],

  // Dimensions conversions to mm
  'mm': [],
  'cm': [{ to: 'mm', factor: 10 }],
  'in': [{ to: 'mm', factor: 25.4 }],

  // Weight conversions to kg
  'kg': [],
  'g': [{ to: 'kg', factor: 0.001 }],
  'lb': [{ to: 'kg', factor: 0.453592 }],

  // Load conversions to kN
  'kN': [],
  'N': [{ to: 'kN', factor: 0.001 }],
};

export function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] || unit;
}

export function parseValue(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;

  const cleaned = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export function normalizeValue(
  value: string | number | null,
  unit: string | null,
  targetUnit?: string
): NormalizedValue {
  const originalValue = value;
  const originalUnit = unit;
  const normalizedUnit = normalizeUnit(unit);
  const numericValue = parseValue(value);

  if (numericValue === null) {
    return {
      value: value,
      unit: normalizedUnit,
      originalValue,
      originalUnit,
    };
  }

  if (!targetUnit && normalizedUnit && UNIT_CONVERSIONS[normalizedUnit]) {
    const conversions = UNIT_CONVERSIONS[normalizedUnit];
    if (conversions.length > 0) {
      const conversion = conversions[0];
      let converted = numericValue * conversion.factor;

      if (conversion.offset !== undefined) {
        converted = (numericValue + conversion.offset) * (conversion.multiply ?? 1);
      }

      return {
        value: Math.round(converted * 1000) / 1000,
        unit: conversion.to,
        originalValue,
        originalUnit,
      };
    }
  }

  return {
    value: numericValue,
    unit: normalizedUnit,
    originalValue,
    originalUnit,
  };
}

export function convertToStandardUnit(
  value: number,
  fromUnit: string,
  toUnit: string
): number | null {
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedTo = normalizeUnit(toUnit);

  if (!normalizedFrom || !normalizedTo) return null;
  if (normalizedFrom === normalizedTo) return value;

  const conversions = UNIT_CONVERSIONS[normalizedFrom];
  if (!conversions) return null;

  const conversion = conversions.find((c) => c.to === normalizedTo);
  if (!conversion) return null;

  let converted = value * conversion.factor;
  if (conversion.offset !== undefined) {
    converted = (value + conversion.offset) * (conversion.multiply ?? 1);
  }

  return Math.round(converted * 1000) / 1000;
}

export function formatValue(value: number | string | null, unit: string | null): string {
  if (value === null) return '—';
  if (typeof value === 'string') return value;
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '');
  return unit ? `${formatted} ${unit}` : formatted;
}

export function compareValues(
  value1: number | null,
  unit1: string | null,
  value2: number | null,
  unit2: string | null,
  tolerance = 0.05
): { match: boolean; normalized1: number | null; normalized2: number | null; unit: string | null } {
  if (value1 === null || value2 === null) {
    return { match: false, normalized1: null, normalized2: null, unit: null };
  }

  const norm1 = normalizeValue(value1, unit1);
  const norm2 = normalizeValue(value2, unit2);

  if (norm1.unit !== norm2.unit) {
    const converted = convertToStandardUnit(norm2.value as number, norm2.unit!, norm1.unit!);
    if (converted === null) {
      return { match: false, normalized1: norm1.value as number, normalized2: norm2.value as number, unit: norm1.unit };
    }
    const diff = Math.abs((norm1.value as number) - converted) / Math.max(Math.abs(norm1.value as number), Math.abs(converted));
    return {
      match: diff <= tolerance,
      normalized1: norm1.value as number,
      normalized2: converted,
      unit: norm1.unit,
    };
  }

  const diff = Math.abs((norm1.value as number) - (norm2.value as number)) / Math.max(Math.abs(norm1.value as number), Math.abs(norm2.value as number));
  return {
    match: diff <= tolerance,
    normalized1: norm1.value as number,
    normalized2: norm2.value as number,
    unit: norm1.unit,
  };
}