import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { scoreItem } from '@/lib/scoring/compare';
import { debugLog, debugError } from '@/lib/debug';

export async function POST(request: NextRequest) {
  try {
    const { limit = 10 } = await request.json();
    const supabase = await createServerSupabaseClient();
    
    // Find enriched items that have matching ground truth
    const { data: enrichedItems, error: enrichedError } = await supabase
      .from('items')
      .select('id, mfg_part_num')
      .eq('status', 'enriched')
      .limit(limit);
    
    if (enrichedError) {
      return NextResponse.json({ error: enrichedError.message }, { status: 500 });
    }
    
    if (!enrichedItems || enrichedItems.length === 0) {
      return NextResponse.json({ 
        message: 'No enriched items to score', 
        summary: { items_scored: 0, avg_accuracy_pct: 0, field_accuracy_breakdown: {} } 
      });
    }
    
    // Find matching ground truth items by mfg_part_num
    const mfgPartNums = enrichedItems.map(i => i.mfg_part_num);
    const { data: gtItems, error: gtError } = await supabase
      .from('items')
      .select('id, mfg_part_num')
      .in('mfg_part_num', mfgPartNums)
      .eq('is_ground_truth', true);
    
    if (gtError) {
      return NextResponse.json({ error: gtError.message }, { status: 500 });
    }
    
    const gtByPartNum = new Map(gtItems?.map(gt => [gt.mfg_part_num, gt.id]) || []);
    
    const results: any[] = [];
    const fieldAccuracy: Record<string, { total: number; matched: number }> = {};
    
    // Track char-limit compliance
    const charLimitCompliance = {
      invoice_desc: { total: 0, compliant: 0 },
      mobile_desc: { total: 0, compliant: 0 },
      short_desc: { total: 0, compliant: 0 },
      long_desc1: { total: 0, compliant: 0 },
      marketing_description: { total: 0, compliant: 0 },
    };
    
    // Track attribute LOV compliance
    let attrLovTotal = 0;
    let attrLovMatched = 0;
    
    for (const enriched of enrichedItems) {
      const gtId = gtByPartNum.get(enriched.mfg_part_num);
      if (!gtId) {
        debugLog(`No ground truth found for ${enriched.mfg_part_num}`);
        continue;
      }
      
      try {
        const result = await scoreItem(enriched.id, gtId);
        results.push({ mfg_part_num: enriched.mfg_part_num, ...result });
        
        // Aggregate field accuracy
        for (const fs of result.field_scores) {
          if (!fieldAccuracy[fs.field_name]) {
            fieldAccuracy[fs.field_name] = { total: 0, matched: 0 };
          }
          fieldAccuracy[fs.field_name].total++;
          if (fs.match_type === 'exact_match' || fs.match_type === 'close_match') {
            fieldAccuracy[fs.field_name].matched++;
          }
        }
        
        // Check char-limit compliance for descriptions
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
        
        // Check attribute LOV compliance (values matching ground truth for same classpath)
        const { data: enrAttrs } = await supabase
          .from('item_attributes')
          .select('label, value, uom')
          .eq('item_id', result.item_id);
        
        const { data: gtAttrs } = await supabase
          .from('item_attributes')
          .select('label, value, uom')
          .eq('item_id', gtId);
        
        if (enrAttrs && gtAttrs) {
          const gtAttrMap = new Map(gtAttrs.map(a => [a.label, a.value]));
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
    
    // Calculate field accuracy breakdown
    const fieldAccuracyBreakdown: Record<string, number> = {};
    for (const [field, stats] of Object.entries(fieldAccuracy)) {
      fieldAccuracyBreakdown[field] = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;
    }
    
    // Calculate char-limit compliance
    const charLimitResults: Record<string, number> = {};
    for (const [field, stats] of Object.entries(charLimitCompliance)) {
      charLimitResults[field] = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : 100;
    }
    
    const attrLovCompliance = attrLovTotal > 0 ? Math.round((attrLovMatched / attrLovTotal) * 100) : 100;
    
    // Confidence-accuracy correlation
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
        if (score >= 80) confidenceBins[bin].correct++; // consider >=80% as "correct" prediction
      }
    }
    
    const confidenceAccuracyCorrelation = Object.fromEntries(
      Object.entries(confidenceBins).map(([bin, stats]) => [
        bin,
        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
      ])
    );
    
    const itemsScored = results.filter(r => r.overall_accuracy_pct !== undefined).length;
    const avgAccuracy = itemsScored > 0 
      ? Math.round(results.filter(r => r.overall_accuracy_pct !== undefined).reduce((a, b) => a + b.overall_accuracy_pct, 0) / itemsScored)
      : 0;
    
    const summary = {
      items_scored: itemsScored,
      avg_accuracy_pct: avgAccuracy,
      field_accuracy_breakdown: fieldAccuracyBreakdown,
      char_limit_compliance: charLimitResults,
      attribute_lov_compliance_pct: attrLovCompliance,
      confidence_accuracy_correlation: confidenceAccuracyCorrelation,
    };
    
    return NextResponse.json({ success: true, summary, results });
  } catch (error) {
    debugError('Batch score error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}