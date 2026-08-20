import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export type MatchType = 'exact_match' | 'close_match' | 'mismatch' | 'missing_in_output' | 'extra_in_output';

export interface FieldScore {
  field_name: string;
  match_type: MatchType;
  expected: string | number | null;
  actual: string | number | null;
  details?: string;
}

export interface ScoreResult {
  item_id: string;
  ground_truth_id: string;
  field_scores: FieldScore[];
  overall_accuracy_pct: number;
  total_fields: number;
  matched_fields: number;
}

function normalizeString(val: string | null | undefined): string {
  if (val === null || val === undefined) return '';
  return val.trim().toLowerCase();
}

function normalizeNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(num) ? null : num;
}

function compareStrings(expected: string | null, actual: string | null): { match: MatchType; details?: string } {
  const normExpected = normalizeString(expected);
  const normActual = normalizeString(actual);
  
  if (!normExpected && !normActual) return { match: 'exact_match' };
  if (!normExpected) return { match: 'extra_in_output', details: 'Expected null/empty, got value' };
  if (!normActual) return { match: 'missing_in_output', details: 'Expected value, got null/empty' };
  
  if (normExpected === normActual) return { match: 'exact_match' };
  
  // Check for close match (e.g., minor formatting differences)
  const levenshtein = (a: string, b: string): number => {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        if (a[i - 1] === b[j - 1]) matrix[j][i] = matrix[j - 1][i - 1];
        else matrix[j][i] = 1 + Math.min(matrix[j - 1][i], matrix[j][i - 1], matrix[j - 1][i - 1]);
      }
    }
    return matrix[b.length][a.length];
  };
  
  const distance = levenshtein(normExpected, normActual);
  const maxLen = Math.max(normExpected.length, normActual.length);
  const similarity = 1 - distance / maxLen;
  
  if (similarity >= 0.85) {
    return { match: 'close_match', details: `Similarity: ${Math.round(similarity * 100)}%` };
  }
  return { match: 'mismatch', details: `Similarity: ${Math.round(similarity * 100)}%` };
}

function compareNumbers(expected: string | number | null, actual: string | number | null): { match: MatchType; details?: string } {
  const expNum = normalizeNumber(expected);
  const actNum = normalizeNumber(actual);
  
  if (expNum === null && actNum === null) return { match: 'exact_match' };
  if (expNum === null) return { match: 'extra_in_output', details: 'Expected null, got number' };
  if (actNum === null) return { match: 'missing_in_output', details: 'Expected number, got null' };
  
  if (expNum === actNum) return { match: 'exact_match' };
  
  const diff = Math.abs(expNum - actNum);
  const maxVal = Math.max(Math.abs(expNum), Math.abs(actNum));
  const relDiff = maxVal > 0 ? diff / maxVal : 0;
  
  if (relDiff <= 0.05) {
    return { match: 'close_match', details: `Relative diff: ${Math.round(relDiff * 100)}%` };
  }
  return { match: 'mismatch', details: `Relative diff: ${Math.round(relDiff * 100)}%` };
}

function compareDescriptions(
  expected: string | null, 
  actual: string | null,
  fieldName: string
): { match: MatchType; details?: string } {
  // For descriptions, we do string comparison with lenient matching
  return compareStrings(expected, actual);
}

function compareAttributes(
  expectedAttrs: Array<{ label: string; value: string | null; uom: string | null }>,
  actualAttrs: Array<{ label: string; value: string | null; uom: string | null }>
): FieldScore[] {
  const scores: FieldScore[] = [];
  const actualByLabel = new Map(actualAttrs.map(a => [normalizeString(a.label), a]));
  
  for (const exp of expectedAttrs) {
    const expLabel = normalizeString(exp.label);
    const actual = actualByLabel.get(expLabel);
    
    if (!actual) {
      scores.push({
        field_name: `attribute:${exp.label}`,
        match_type: 'missing_in_output',
        expected: exp.value,
        actual: null,
        details: `Expected attribute "${exp.label}" not found in output`
      });
      continue;
    }
    
    const valueMatch = compareStrings(exp.value, actual.value);
    const uomMatch = compareStrings(exp.uom, actual.uom);
    
    let matchType: 'exact_match' | 'close_match' | 'mismatch' = 'exact_match';
    const details: string[] = [];
    
    if (valueMatch.match !== 'exact_match') {
      matchType = valueMatch.match === 'close_match' ? 'close_match' : 'mismatch';
      if (valueMatch.details) details.push(`value: ${valueMatch.details}`);
    }
    if (uomMatch.match !== 'exact_match') {
      matchType = uomMatch.match === 'close_match' ? 'close_match' : 'mismatch';
      if (uomMatch.details) details.push(`uom: ${uomMatch.details}`);
    }
    
    scores.push({
      field_name: `attribute:${exp.label}`,
      match_type: matchType,
      expected: exp.value,
      actual: actual.value,
      details: details.join('; ') || undefined
    });
  }
  
  // Check for extra attributes in output
  const expectedLabels = new Set(expectedAttrs.map(e => normalizeString(e.label)));
  for (const act of actualAttrs) {
    if (!expectedLabels.has(normalizeString(act.label))) {
      scores.push({
        field_name: `attribute:${act.label}`,
        match_type: 'extra_in_output',
        expected: null,
        actual: act.value,
        details: `Extra attribute "${act.label}" in output not in ground truth`
      });
    }
  }
  
  return scores;
}

export async function scoreItem(enrichedItemId: string, groundTruthItemId: string): Promise<ScoreResult> {
  // Fetch enriched item with all related data
  const { data: enriched, error: enrichedError } = await supabase
    .from('items')
    .select(`
      *,
      item_descriptions(*),
      item_attributes(*),
      item_specs(*)
    `)
    .eq('id', enrichedItemId)
    .maybeSingle();
  
  if (enrichedError || !enriched) {
    throw new Error(`Enriched item not found: ${enrichedError?.message}`);
  }
  
  // Fetch ground truth item with all related data
  const { data: groundTruth, error: gtError } = await supabase
    .from('items')
    .select(`
      *,
      item_descriptions(*),
      item_attributes(*),
      item_specs(*)
    `)
    .eq('id', groundTruthItemId)
    .maybeSingle();
  
  if (gtError || !groundTruth) {
    throw new Error(`Ground truth item not found: ${gtError?.message}`);
  }
  
  const fieldScores: FieldScore[] = [];
  
  // Compare main item fields
  const itemFields = [
    { field: 'manufacturer_name', type: 'string' as const },
    { field: 'brand_name', type: 'string' as const },
    { field: 'dept', type: 'string' as const },
    { field: 'class', type: 'string' as const },
    { field: 'fine', type: 'string' as const },
    { field: 'classpath', type: 'string' as const },
  ];
  
  for (const { field, type } of itemFields) {
    const expected = (groundTruth as any)[field];
    const actual = (enriched as any)[field];
    
    let result;
    if (type === 'string') {
      result = compareStrings(expected, actual);
    } else {
      result = compareNumbers(expected, actual);
    }
    
    fieldScores.push({
      field_name: field,
      match_type: result.match,
      expected,
      actual,
      details: result.details
    });
  }
  
  // Compare descriptions
  const descFields = ['invoice_desc', 'mobile_desc', 'short_desc', 'long_desc1', 'marketing_description'];
  const gtDescs = new Map(groundTruth.item_descriptions?.map((d: any) => [d.field_name, d.value]) || []);
  const enrDescs = new Map(enriched.item_descriptions?.map((d: any) => [d.field_name, d.value]) || []);
  
  for (const field of descFields) {
    const expected = gtDescs.get(field) || null;
    const actual = enrDescs.get(field) || null;
    const result = compareDescriptions(expected, actual, field);
    
    fieldScores.push({
      field_name: `description:${field}`,
      match_type: result.match,
      expected,
      actual,
      details: result.details
    });
  }
  
  // Compare attributes
  const gtAttrs = (groundTruth.item_attributes || []).map((a: any) => ({
    label: a.label,
    value: a.value,
    uom: a.uom
  }));
  const enrAttrs = (enriched.item_attributes || []).map((a: any) => ({
    label: a.label,
    value: a.value,
    uom: a.uom
  }));
  
  const attrScores = compareAttributes(gtAttrs, enrAttrs);
  fieldScores.push(...attrScores);
  
  // Compare specs
  const gtSpecs = groundTruth.item_specs;
  const enrSpecs = enriched.item_specs;
  
  if (gtSpecs || enrSpecs) {
    const specFields = ['upc', 'ean', 'gtin', 'unspsc', 'list_price', 'length', 'width', 'height', 'weight', 'country_of_origin', 'warranty'];
    const gtSpec = gtSpecs?.[0] || {};
    const enrSpec = enrSpecs?.[0] || {};
    
    for (const field of specFields) {
      const expected = gtSpec[field];
      const actual = enrSpec[field];
      
      let result: { match: MatchType; details?: string };
      if (field === 'list_price' || field === 'length' || field === 'width' || field === 'height' || field === 'weight') {
        result = compareNumbers(expected, actual);
      } else {
        result = compareStrings(expected, actual);
      }
      
      fieldScores.push({
        field_name: `spec:${field}`,
        match_type: result.match,
        expected,
        actual,
        details: result.details
      });
    }
  }
  
  // Calculate overall accuracy
  const totalFields = fieldScores.length;
  const matchedFields = fieldScores.filter(f => 
    f.match_type === 'exact_match' || f.match_type === 'close_match'
  ).length;
  const overallAccuracyPct = totalFields > 0 ? Math.round((matchedFields / totalFields) * 100) : 0;
  
  return {
    item_id: enrichedItemId,
    ground_truth_id: groundTruthItemId,
    field_scores: fieldScores,
    overall_accuracy_pct: overallAccuracyPct,
    total_fields: totalFields,
    matched_fields: matchedFields,
  };
}