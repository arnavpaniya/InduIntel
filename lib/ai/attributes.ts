function parseFractionToDecimal(text: string): number | null {
  const mixedNumberMatch = text.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (mixedNumberMatch) {
    const whole = parseInt(mixedNumberMatch[1], 10);
    const numerator = parseInt(mixedNumberMatch[2], 10);
    const denominator = parseInt(mixedNumberMatch[3], 10);
    const fraction = numerator / denominator;
    return whole + fraction;
  }

  const fractionOnlyMatch = text.match(/^(\d+)\/(\d+)$/);
  if (fractionOnlyMatch) {
    const numerator = parseInt(fractionOnlyMatch[1], 10);
    const denominator = parseInt(fractionOnlyMatch[2], 10);
    if (denominator > 0) {
      return numerator / denominator;
    }
  }

  const decimalMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (decimalMatch) {
    return parseFloat(decimalMatch[1]);
  }

  return null;
}

function decimalToFractionInches(value: number): string {
  const whole = Math.floor(value);
  const decimal = value - whole;
  
  const fractions = [
    { denom: 64, label: '1/64' },
    { denom: 32, label: '1/32' },
    { denom: 16, label: '1/16' },
    { denom: 8, label: '1/8' },
    { denom: 4, label: '1/4' },
    { denom: 2, label: '1/2' },
  ];

  for (const { denom, label } of fractions) {
    const numerator = Math.round(decimal * denom);
    if (numerator > 0 && numerator < denom && Math.abs(decimal - numerator / denom) < 0.01) {
      return whole > 0 ? `${whole}-${label}` : label;
    }
  }

  if (decimal === 0) {
    return `${whole} in`;
  }

  return `${value} in`;
}

export function formatMeasurement(value: number | null, uom: string | null): string | null {
  if (value === null || value === undefined) return null;
  const unit = (uom || '').toLowerCase();
  
  if (unit.includes('in') || unit === 'inch' || unit === 'inches') {
    return decimalToFractionInches(value);
  }
  
  if (unit.includes('ft') || unit === 'foot' || unit === 'feet') {
    return `${value} ft`;
  }
  
  if (unit.includes('mm')) {
    return `${value} mm`;
  }
  
  if (unit.includes('cm')) {
    return `${value} cm`;
  }
  
  if (unit.includes('m') && !unit.includes('mm') && !unit.includes('cm')) {
    return `${value} m`;
  }
  
  if (unit.includes('lb') || unit === 'lbs' || unit === 'pound') {
    return `${value} lb`;
  }
  
  if (unit.includes('kg')) {
    return `${value} kg`;
  }
  
  if (unit.includes('oz')) {
    return `${value} oz`;
  }
  
  if (unit.includes('g') && !unit.includes('kg')) {
    return `${value} g`;
  }

  return `${value} ${uom || ''}`.trim();
}

export function parseMeasurement(text: string): { value: number; uom: string } | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(in|inch|inches|")/gi,
    /(\d+(?:\.\d+)?)\s*(ft|foot|feet|')/gi,
    /(\d+(?:\.\d+)?)\s*(mm|millimeter)/gi,
    /(\d+(?:\.\d+)?)\s*(cm|centimeter)/gi,
    /(\d+(?:\.\d+)?)\s*(m|meter)(?![m])/gi,
    /(\d+(?:\.\d+)?)\s*(lb|lbs|pound)/gi,
    /(\d+(?:\.\d+)?)\s*(kg|kilogram)/gi,
    /(\d+(?:\.\d+)?)\s*(oz|ounce)/gi,
    /(\d+(?:\.\d+)?)\s*(g|gram)(?![a-z])/gi,
    /(\d+(?:\.\d+)?)\s*(v|volt|voltage)/gi,
    /(\d+(?:\.\d+)?)\s*(a|amp|amperage|ampere)/gi,
    /(\d+(?:\.\d+)?)\s*(w|watt)/gi,
    /(\d+(?:\.\d+)?)\s*(hz|hertz)/gi,
    /(\d+(?:\.\d+)?)\s*(dba|db)/gi,
    /(\d+(?:\.\d+)?)\s*(rpm)/gi,
    /(\d+(?:\.\d+)?)\s*(psi)/gi,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const numMatch = match[0].match(/(\d+(?:\.\d+)?)/);
      const uomMatch = match[0].match(/([a-zA-Z"']+)/);
      if (numMatch && uomMatch) {
        return { value: parseFloat(numMatch[1]), uom: uomMatch[1] };
      }
    }
  }

  return null;
}

export const ATTRIBUTE_LABELS = [
  'Series', 'Model', 'Number of Wash Cycles', 'Voltage Rating', 'Amperage Rating',
  'Mounting Type', 'Plug Type', 'Size', 'Depth With Door Open', 'Minimum Height',
  'Maximum Height', 'Sound Level', 'Material', 'Color', 'Additional Information',
  'Capacity', 'Finish', 'Style', 'Grit', 'Diameter', 'Thickness', 'Arbor Size',
  'Max RPM', 'Application', 'Includes', 'Warranty', 'Certifications',
  'Energy Star', 'ADA Compliant', 'Color Family', 'Item Features',
];