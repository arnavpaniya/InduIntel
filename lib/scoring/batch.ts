import { scoreItem } from '@/lib/scoring/compare';
import { debugError, debugLog } from '@/lib/debug';
import { BatchScoreSummary } from '@/lib/types';

const EMPTY_SUMMARY: BatchScoreSummary = {
  items_scored: 0,
  avg_accuracy_pct: 0,
  field_accuracy_breakdown: {},
  char_limit_compliance: {},
  attribute_lov_compliance_pct: 0,
  confidence_accuracy_correlation: {},
};

export async function scoreBatchItems(supabase: any, limit: number = 10): Promise<{ summary: BatchScoreSummary; results: any[] }> {
  const { data: gtItems, error: gtError } = await supabase
    .from('items')
    .select('id, mfg_part_num')
    .eq('is_ground_truth', true);

  if (gtError) {
    throw new Error(gtError.message);
  }

  const gtByPartNum = new Map(gtItems?.map((gt: any) => [gt.mfg_part_num, gt.id]) || []);
  const mfgPartNums = Array.from(gtByPartNum.keys());

  if (mfgPartNums.length === 0) {
    return {
      summary: EMPTY_SUMMARY,
      results: [],
    };
  }

  const { data: enrichedItems, error: enrichedError } = await supabase
    .from('items')
    .select('id, mfg_part_num')
    .eq('status', 'enriched')
    .eq('is_ground_truth', false)
    .in('mfg_part_num', mfgPartNums)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (enrichedError) {
    throw new Error(enrichedError.message);
  }

  if (!enrichedItems || enrichedItems.length === 0) {
    return {
      summary: EMPTY_SUMMARY,
      results: [],
    };
  }

  const results: any[] = [];
  const fieldAccuracy: Record<string, { total: number; matched: number }> = {};

  const charLimitCompliance = {
    invoice_desc: { total: 0, compliant: 0 },
    mobile_desc: { total: 0, compliant: 0 },
    short_desc: { total: 0, compliant: 0 },
    long_desc1: { total: 0, compliant: 0 },
    marketing_description: { total: 0, compliant: 0 },
  };

  let attrLovTotal = 0;
  let attrLovMatched = 0;

  for (const enriched of enrichedItems) {
    const gtId = gtByPartNum.get(enriched.mfg_part_num);
    if (!gtId) {
      debugLog(`No ground truth found for ${enriched.mfg_part_num}`);
      continue;
    }

    if (enriched.id === gtId) {
      debugLog(`Skipping self-comparison for ${enriched.mfg_part_num}`);
      continue;
    }

    try {
      const result = await scoreItem(enriched.id, gtId as string);
      results.push({ mfg_part_num: enriched.mfg_part_num, ...result });

      for (const fs of result.field_scores) {
        if (!fieldAccuracy[fs.field_name]) {
          fieldAccuracy[fs.field_name] = { total: 0, matched: 0 };
        }
        fieldAccuracy[fs.field_name].total++;
        if (fs.match_type === 'exact_match' || fs.match_type === 'close_match') {
          fieldAccuracy[fs.field_name].matched++;
        }
      }

      const { data: descs } = await supabase
        .from('item_descriptions')
        .select('field_name, char_count')
        .eq('item_id', result.item_id);

      if (descs) {
        for (const d of descs) {
          const key = d.field_name as keyof typeof charLimitCompliance;
          if (key in charLimitCompliance) {
            charLimitCompliance[key].total++;
            const maxLengths: Record<string, number> = {
              invoice_desc: 40,
              mobile_desc: 80,
              short_desc: 180,
              long_desc1: 500,
              marketing_description: 350,
            };
            if (d.char_count <= maxLengths[key]) {
              charLimitCompliance[key].compliant++;
            }
          }
        }
      }

      const { data: enrAttrs } = await supabase
        .from('item_attributes')
        .select('label, value, uom')
        .eq('item_id', result.item_id);

      const { data: gtAttrs } = await supabase
        .from('item_attributes')
        .select('label, value, uom')
        .eq('item_id', gtId);

      if (enrAttrs && gtAttrs) {
        const gtAttrMap = new Map(gtAttrs.map((a: any) => [a.label, a.value]));
        for (const enrAttr of enrAttrs) {
          attrLovTotal++;
          const gtValue = gtAttrMap.get(enrAttr.label);
          if (gtValue && gtValue === enrAttr.value) {
            attrLovMatched++;
          }
        }
      }
    } catch (error) {
      debugError(`Score error for ${enriched.mfg_part_num}:`, error);
      results.push({ item_id: enriched.id, mfg_part_num: enriched.mfg_part_num, error: String(error) });
    }
  }

  const fieldAccuracyBreakdown: Record<string, number> = {};
  for (const [field, stats] of Object.entries(fieldAccuracy)) {
    fieldAccuracyBreakdown[field] = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;
  }

  const charLimitResults: Record<string, number> = {};
  for (const [field, stats] of Object.entries(charLimitCompliance)) {
    charLimitResults[field] = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 100;
  }

  const attrLovCompliance = attrLovTotal > 0 ? Math.round((attrLovMatched / attrLovTotal) * 100) : 100;

  const confidenceBins = {
    '0-20': { total: 0, correct: 0 },
    '21-40': { total: 0, correct: 0 },
    '41-60': { total: 0, correct: 0 },
    '61-80': { total: 0, correct: 0 },
    '81-100': { total: 0, correct: 0 },
  };

  for (const r of results) {
    if (r.overall_accuracy_pct !== undefined) {
      const score = r.overall_accuracy_pct;
      let bin: keyof typeof confidenceBins;
      if (score <= 20) bin = '0-20';
      else if (score <= 40) bin = '21-40';
      else if (score <= 60) bin = '41-60';
      else if (score <= 80) bin = '61-80';
      else bin = '81-100';
      confidenceBins[bin].total++;
      if (score >= 80) confidenceBins[bin].correct++;
    }
  }

  const confidenceAccuracyCorrelation = Object.fromEntries(
    Object.entries(confidenceBins).map(([bin, stats]) => [
      bin,
      stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    ])
  );

  const scoredResults = results.filter(r => r.overall_accuracy_pct !== undefined);
  const itemsScored = scoredResults.length;
  const avgAccuracy = itemsScored > 0
    ? Math.round(scoredResults.reduce((a, b) => a + b.overall_accuracy_pct, 0) / itemsScored)
    : 0;

  return {
    summary: {
      items_scored: itemsScored,
      avg_accuracy_pct: avgAccuracy,
      field_accuracy_breakdown: fieldAccuracyBreakdown,
      char_limit_compliance: charLimitResults,
      attribute_lov_compliance_pct: attrLovCompliance,
      confidence_accuracy_correlation: confidenceAccuracyCorrelation,
    },
    results,
  };
}
