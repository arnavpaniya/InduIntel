import { ProductAttribute, ProductCategory, Evidence } from '@/types';
import { getRequiredAttributes, getAllAttributes, getAttributeUnit } from '@/schemas';

export interface EnrichmentResult {
  enrichedAttributes: ProductAttribute[];
  missingAttributes: string[];
  inferredCount: number;
}

export function enrichProduct(
  attributes: ProductAttribute[],
  category: ProductCategory,
  evidenceMap: Map<string, Evidence[]>
): EnrichmentResult {
  const requiredAttrs = getRequiredAttributes(category);
  const allAttrs = getAllAttributes(category);
  const existingKeys = new Set(attributes.map(a => a.key));

  const missingAttributes = requiredAttrs.filter(key => !existingKeys.has(key));
  const enrichedAttributes = [...attributes];
  let inferredCount = 0;

  missingAttributes.forEach(key => {
    const inferred = attemptInference(key, category, attributes, evidenceMap);
    if (inferred) {
      enrichedAttributes.push(inferred);
      inferredCount++;
    } else {
      enrichedAttributes.push(createUnknownAttribute(key, category));
    }
  });

  allAttrs.forEach(key => {
    if (!existingKeys.has(key) && !missingAttributes.includes(key)) {
      enrichedAttributes.push(createUnknownAttribute(key, category));
    }
  });

  return {
    enrichedAttributes,
    missingAttributes,
    inferredCount,
  };
}

function attemptInference(
  key: string,
  category: ProductCategory,
  existingAttributes: ProductAttribute[],
  evidenceMap: Map<string, Evidence[]>
): ProductAttribute | null {
  const inferences: Record<string, (attrs: ProductAttribute[]) => ProductAttribute | null> = {
    power: inferPower,
    voltage: inferVoltage,
    current: inferCurrent,
    speed: inferSpeed,
    efficiency: inferEfficiency,
    rated_torque: inferRatedTorque,
    flow_rate: inferFlowRate,
    head: inferHead,
  };

  const inferFn = inferences[key];
  if (inferFn) {
    return inferFn(existingAttributes);
  }

  return null;
}

function inferPower(attrs: ProductAttribute[]): ProductAttribute | null {
  const voltage = attrs.find(a => a.key === 'voltage' && a.value !== null);
  const current = attrs.find(a => a.key === 'current' && a.value !== null);
  const phase = attrs.find(a => a.key === 'phase' && a.value !== null);
  const efficiency = attrs.find(a => a.key === 'efficiency' && a.value !== null);
  const powerFactor = attrs.find(a => a.key === 'power_factor' && a.value !== null);

  if (voltage && current) {
    const v = Number(voltage.value);
    const i = Number(current.value);
    const ph = phase ? Number(phase.value) : 3;
    const eff = efficiency ? Number(efficiency.value) / 100 : 0.9;
    const pf = powerFactor ? Number(powerFactor.value) : 0.85;

    let power: number;
    if (ph === 3) {
      power = (Math.sqrt(3) * v * i * pf * eff) / 1000;
    } else {
      power = (v * i * pf * eff) / 1000;
    }

    return createInferredAttribute('power', Math.round(power * 100) / 100, 'kW', 0.7, attrs);
  }

  return null;
}

function inferVoltage(attrs: ProductAttribute[]): ProductAttribute | null {
  return null;
}

function inferCurrent(attrs: ProductAttribute[]): ProductAttribute | null {
  const power = attrs.find(a => a.key === 'power' && a.value !== null);
  const voltage = attrs.find(a => a.key === 'voltage' && a.value !== null);
  const phase = attrs.find(a => a.key === 'phase' && a.value !== null);
  const efficiency = attrs.find(a => a.key === 'efficiency' && a.value !== null);
  const powerFactor = attrs.find(a => a.key === 'power_factor' && a.value !== null);

  if (power && voltage) {
    const p = Number(power.value) * 1000;
    const v = Number(voltage.value);
    const ph = phase ? Number(phase.value) : 3;
    const eff = efficiency ? Number(efficiency.value) / 100 : 0.9;
    const pf = powerFactor ? Number(powerFactor.value) : 0.85;

    let current: number;
    if (ph === 3) {
      current = p / (Math.sqrt(3) * v * pf * eff);
    } else {
      current = p / (v * pf * eff);
    }

    return createInferredAttribute('current', Math.round(current * 10) / 10, 'A', 0.7, attrs);
  }

  return null;
}

function inferSpeed(attrs: ProductAttribute[]): ProductAttribute | null {
  const frequency = attrs.find(a => a.key === 'frequency' && a.value !== null);
  const poles = attrs.find(a => a.key === 'poles' && a.value !== null);

  if (frequency) {
    const f = Number(frequency.value);
    const p = poles ? Number(poles.value) : 4;
    const syncSpeed = (120 * f) / p;
    const slip = 0.03;
    const speed = Math.round(syncSpeed * (1 - slip));

    return createInferredAttribute('speed', speed, 'RPM', 0.75, attrs);
  }

  return null;
}

function inferEfficiency(attrs: ProductAttribute[]): ProductAttribute | null {
  const power = attrs.find(a => a.key === 'power' && a.value !== null);
  const frameSize = attrs.find(a => a.key === 'frame_size' && a.value !== null);

  if (power) {
    const p = Number(power.value);
    let efficiency: number;

    if (p <= 0.75) efficiency = 75;
    else if (p <= 1.5) efficiency = 80;
    else if (p <= 4) efficiency = 84;
    else if (p <= 7.5) efficiency = 87;
    else if (p <= 15) efficiency = 89;
    else if (p <= 37) efficiency = 91;
    else if (p <= 75) efficiency = 92;
    else if (p <= 200) efficiency = 93;
    else efficiency = 94;

    if (frameSize) {
      const frame = String(frameSize.value);
      if (frame.includes('160') || frame.includes('180')) efficiency += 1;
      if (frame.includes('200') || frame.includes('225')) efficiency += 1.5;
    }

    return createInferredAttribute('efficiency', Math.min(efficiency, 96), '%', 0.65, attrs);
  }

  return null;
}

function inferRatedTorque(attrs: ProductAttribute[]): ProductAttribute | null {
  const power = attrs.find(a => a.key === 'power' && a.value !== null);
  const speed = attrs.find(a => a.key === 'speed' && a.value !== null);

  if (power && speed) {
    const p = Number(power.value) * 1000;
    const n = Number(speed.value);
    const torque = (p * 60) / (2 * Math.PI * n);

    return createInferredAttribute('rated_torque', Math.round(torque * 10) / 10, 'Nm', 0.75, attrs);
  }

  return null;
}

function inferFlowRate(attrs: ProductAttribute[]): ProductAttribute | null {
  return null;
}

function inferHead(attrs: ProductAttribute[]): ProductAttribute | null {
  return null;
}

function createInferredAttribute(
  key: string,
  value: string | number,
  unit: string,
  confidence: number,
  sourceAttrs: ProductAttribute[]
): ProductAttribute {
  const evidence: Evidence[] = sourceAttrs
    .filter(a => a.evidence.length > 0)
    .flatMap(a => a.evidence.slice(0, 1))
    .slice(0, 2);

  return {
    key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value,
    unit,
    normalizedValue: value,
    normalizedUnit: unit,
    status: 'INFERRED',
    confidence,
    evidence,
  };
}

function createUnknownAttribute(key: string, category: ProductCategory): ProductAttribute {
  return {
    key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: null,
    unit: getAttributeUnit(category, key),
    normalizedValue: null,
    normalizedUnit: null,
    status: 'UNKNOWN',
    confidence: 0,
    evidence: [],
  };
}

export function calculateCompletenessScore(
  attributes: ProductAttribute[],
  category: ProductCategory
): number {
  const required = getRequiredAttributes(category);
  if (required.length === 0) return 100;

  const found = required.filter(key =>
    attributes.some(a => a.key === key && a.status !== 'UNKNOWN' && a.value !== null)
  ).length;

  return Math.round((found / required.length) * 100);
}