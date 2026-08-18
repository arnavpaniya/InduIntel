import { ProductAttribute, Evidence, Conflict, ConflictSeverity, ProductCategory } from '@/types';
import { getRequiredAttributes } from '@/schemas';
import { compareValues } from '@/lib/normalization/units';
import { v4 as uuidv4 } from 'uuid';

export interface ValidationResult {
  attributes: ProductAttribute[];
  conflicts: Conflict[];
  missingAttributes: string[];
  completeness: number;
  confidence: number;
}

export function validateAndScore(
  attributes: ProductAttribute[],
  category: ProductCategory,
  allEvidence: Map<string, Evidence[]>
): ValidationResult {
  const requiredAttrs = getRequiredAttributes(category);
  const allAttrs = [...requiredAttrs, ...attributes.map(a => a.key).filter(k => !requiredAttrs.includes(k))];

  const attributeMap = new Map(attributes.map(a => [a.key, a]));

  const conflicts = detectConflicts(attributes);
  const missingAttributes = requiredAttrs.filter(key => !attributeMap.has(key));
  const conflictKeys = new Set(conflicts.map(c => c.attributeKey));

  const validatedAttributes = attributes.map(attr => {
    if (conflictKeys.has(attr.key)) {
      return { ...attr, status: 'CONFLICT' as const };
    }
    return attr;
  });

  const completeness = calculateCompleteness(validatedAttributes, requiredAttrs);
  const confidence = calculateConfidence(validatedAttributes);

  return {
    attributes: validatedAttributes,
    conflicts,
    missingAttributes,
    completeness,
    confidence,
  };
}

function detectConflicts(attributes: ProductAttribute[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const attributeGroups = new Map<string, ProductAttribute[]>();

  attributes.forEach(attr => {
    if (!attributeGroups.has(attr.key)) {
      attributeGroups.set(attr.key, []);
    }
    attributeGroups.get(attr.key)!.push(attr);
  });

  attributeGroups.forEach((group, key) => {
    if (group.length <= 1) return;

    const verifiedAttrs = group.filter(a => a.status === 'VERIFIED' && a.value !== null);
    if (verifiedAttrs.length <= 1) return;

    const values = verifiedAttrs.map(a => ({
      value: a.value,
      unit: a.unit,
      source: a.evidence[0] || { documentId: '', documentName: '', page: 0, quote: '' },
    }));

    const baseValue = values[0];
    let hasConflict = false;

    for (let i = 1; i < values.length; i++) {
      const comparison = compareValues(baseValue.value as number, baseValue.unit, values[i].value as number, values[i].unit);
      if (!comparison.match) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
      const severity = determineSeverity(key, values);
      const recommended = determineRecommendedValue(values);

      conflicts.push({
        id: uuidv4(),
        attributeKey: key,
        values,
        recommendedValue: recommended.value,
        recommendedUnit: recommended.unit,
        confidence: calculateConflictConfidence(values),
        severity,
        requiresHumanReview: severity === 'HIGH' || severity === 'MEDIUM',
      });
    }
  });

  return conflicts;
}

function determineSeverity(attributeKey: string, values: Conflict['values']): ConflictSeverity {
  const criticalAttributes = ['voltage', 'current', 'power', 'speed', 'inner_diameter', 'outer_diameter', 'flow_rate', 'head'];
  if (criticalAttributes.includes(attributeKey)) return 'HIGH';

  const numericValues = values.map(v => (typeof v.value === 'number' ? v.value : parseFloat(String(v.value)))).filter(v => !isNaN(v));
  if (numericValues.length < 2) return 'LOW';

  const max = Math.max(...numericValues);
  const min = Math.min(...numericValues);
  const variance = (max - min) / max;

  if (variance > 0.2) return 'HIGH';
  if (variance > 0.05) return 'MEDIUM';
  return 'LOW';
}

function determineRecommendedValue(values: Conflict['values']): { value: string | number | null; unit: string | null } {
  const verifiedValues = values.filter(v => v.source.quote);
  if (verifiedValues.length === 0) return { value: null, unit: null };

  const valueCounts = new Map<string, { count: number; value: typeof verifiedValues[0] }>();
  verifiedValues.forEach(v => {
    const key = `${v.value}|${v.unit}`;
    const existing = valueCounts.get(key) || { count: 0, value: v };
    valueCounts.set(key, { count: existing.count + 1, value: v });
  });

  let maxCount = 0;
  let recommended = verifiedValues[0];
  valueCounts.forEach(({ count, value }) => {
    if (count > maxCount) {
      maxCount = count;
      recommended = value;
    }
  });

  return { value: recommended.value, unit: recommended.unit };
}

function calculateConflictConfidence(values: Conflict['values']): number {
  const valueCounts = new Map<string, number>();
  values.forEach(v => {
    const key = `${v.value}|${v.unit}`;
    valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
  });

  const maxCount = Math.max(...valueCounts.values());
  return maxCount / values.length;
}

function calculateCompleteness(attributes: ProductAttribute[], requiredAttributes: string[]): number {
  if (requiredAttributes.length === 0) return 100;

  const found = requiredAttributes.filter(key =>
    attributes.some(a => a.key === key && a.status !== 'UNKNOWN' && a.value !== null)
  ).length;

  return Math.round((found / requiredAttributes.length) * 100);
}

function calculateConfidence(attributes: ProductAttribute[]): number {
  if (attributes.length === 0) return 0;

  const weightedSum = attributes.reduce((sum, attr) => {
    const weight = attr.status === 'VERIFIED' ? 1 : attr.status === 'INFERRED' ? 0.7 : 0;
    return sum + attr.confidence * weight;
  }, 0);

  const totalWeight = attributes.reduce((sum, attr) => {
    return sum + (attr.status === 'VERIFIED' ? 1 : attr.status === 'INFERRED' ? 0.7 : 0);
  }, 0);

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

export function mergeAttributesFromSources(
  sourceAttributes: ProductAttribute[][],
  category: ProductCategory
): ProductAttribute[] {
  const merged = new Map<string, ProductAttribute[]>();

  sourceAttributes.forEach(attrs => {
    attrs.forEach(attr => {
      if (!merged.has(attr.key)) {
        merged.set(attr.key, []);
      }
      merged.get(attr.key)!.push(attr);
    });
  });

  const result: ProductAttribute[] = [];
  merged.forEach((attrs, key) => {
    const verified = attrs.filter(a => a.status === 'VERIFIED');
    if (verified.length > 0) {
      const best = verified.reduce((a, b) => a.confidence > b.confidence ? a : b);
      result.push(best);
    } else {
      const inferred = attrs.filter(a => a.status === 'INFERRED');
      if (inferred.length > 0) {
        const best = inferred.reduce((a, b) => a.confidence > b.confidence ? a : b);
        result.push(best);
      } else {
        const unknown = attrs.find(a => a.status === 'UNKNOWN');
        if (unknown) result.push(unknown);
      }
    }
  });

  return result;
}