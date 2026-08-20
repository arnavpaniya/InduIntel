import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { debugLog, debugError, debugWarn, debugJson } from '@/lib/debug';

const ENRICHMENT_STEPS = [
  'manufacturer',
  'classify',
  'attributes',
  'descriptions',
  'specs',
] as const;

type EnrichmentStep = typeof ENRICHMENT_STEPS[number];

async function callStep(step: EnrichmentStep, itemId: string, baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/enrich/${step}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId }),
  });
  return response.json();
}

async function logEnrichment(
  supabase: any,
  itemId: string,
  step: string,
  status: 'success' | 'error',
  error: string | null,
  input: any,
  output: any,
  durationMs: number
) {
  await supabase.from('enrichment_logs').insert({
    item_id: itemId,
    step,
    status,
    error,
    input_json: input,
    output_json: output,
    duration_ms: durationMs,
  });
}


export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { item_id } = await request.json();
    if (!item_id) {
      return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    }

    debugLog('[RUN] Starting orchestration for item_id:', item_id);

    const supabase = await createServerSupabaseClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, status')
      .eq('id', item_id)
      .maybeSingle();

    debugLog('[RUN] Initial fetch - itemError:', itemError?.message, 'item found:', !!item);

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: 'Item not found', item_id }, { status: 404 });
    }

    debugLog('[RUN] Setting status to enriching...');
    const { data: statusData, error: statusError } = await getSupabaseAdmin()
      .from('items')
      .update({ status: 'enriching', updated_at: new Date().toISOString() })
      .eq('id', item_id)
      .select();

    debugJson('[RUN] Status update result:', { data: statusData, error: statusError, count: statusData?.length });

    const stepResults: Record<string, any> = {};
    let hasErrors = false;
    const stepConfidences: number[] = [];

    for (const step of ENRICHMENT_STEPS) {
      const stepStart = Date.now();
      try {
        debugLog(`[RUN] Calling step: ${step}`);
        const result = await callStep(step, item_id, baseUrl);
        stepResults[step] = { success: true, data: result, duration: Date.now() - stepStart };
        
        if (!result.success) {
          hasErrors = true;
          debugError(`[RUN] Step ${step} failed:`, result.error);
        } else {
          debugLog(`[RUN] Step ${step} succeeded in ${Date.now() - stepStart}ms`);
          // Handle different response formats:
          // manufacturer/classify: { data: { data: { confidence, ... } } }
          // attributes/descriptions/specs: { data: { confidence, ... } }
          const stepConfidence = result.data?.data?.confidence ?? result.data?.confidence;
          if (stepConfidence !== undefined && typeof stepConfidence === 'number') {
            stepConfidences.push(stepConfidence);
          }
        }
      } catch (error) {
        hasErrors = true;
        stepResults[step] = { success: false, error: String(error), duration: Date.now() - stepStart };
        debugError(`[RUN] Step ${step} exception:`, error);
      }
    }

    const { data: enrichedItem, error: fetchError } = await supabase
      .from('items')
      .select(`
        *,
        item_descriptions(*),
        item_attributes(*),
        item_assets(*),
        item_specs(*)
      `)
      .eq('id', item_id)
      .maybeSingle();

    debugLog('[RUN] Final fetch - fetchError:', fetchError?.message, 'item found:', !!enrichedItem);

    if (fetchError) {
      await logEnrichment(supabase, item_id, 'orchestrator', 'error', fetchError.message, { item_id }, null, Date.now() - startTime);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!enrichedItem) {
      await logEnrichment(supabase, item_id, 'orchestrator', 'error', 'Item not found after enrichment', { item_id }, null, Date.now() - startTime);
      return NextResponse.json({ error: 'Item not found after enrichment', item_id }, { status: 404 });
    }

    // Compute confidenceScore (0-100)
    const requiredFields: Array<{ table: string; fields?: string[]; minCount?: number }> = [
      { table: 'items', fields: ['manufacturer_name', 'brand_name', 'dept', 'class', 'fine', 'classpath'] },
      { table: 'item_descriptions', fields: ['invoice_desc', 'mobile_desc', 'short_desc', 'long_desc1'] },
      { table: 'item_attributes', minCount: 5 },
      { table: 'item_specs', fields: ['upc', 'length', 'width', 'height', 'weight', 'warranty'] },
    ];

    let totalExpected = 0;
    let totalFilled = 0;

    for (const req of requiredFields) {
      if (req.table === 'items' && req.fields) {
        for (const field of req.fields) {
          totalExpected++;
          if (enrichedItem[field]) totalFilled++;
        }
      } else if (req.table === 'item_descriptions' && req.fields) {
        for (const field of req.fields) {
          totalExpected++;
          const desc = enrichedItem.item_descriptions?.find((d: any) => d.field_name === field);
          if (desc?.value) totalFilled++;
        }
      } else if (req.table === 'item_attributes') {
        // minCount is required in config for item_attributes, but type allows optional
        // Runtime guard with fallback and warning
        const minCount = req.minCount ?? 0;
        if (req.minCount === undefined) {
          debugWarn('[RUN] item_attributes requirement missing minCount, defaulting to 0');
        }
        totalExpected += minCount;
        const count = enrichedItem.item_attributes?.length || 0;
        totalFilled += Math.min(count, minCount);
      } else if (req.table === 'item_specs' && req.fields) {
        for (const field of req.fields) {
          totalExpected++;
          if (enrichedItem.item_specs?.[field]) totalFilled++;
        }
      }
    }

    const confidenceScore = totalExpected > 0 ? Math.round((totalFilled / totalExpected) * 100) : 0;
    
    // fieldConfidence: average of per-step LLM self-reported confidence (0-1)
    const fieldConfidence = stepConfidences.length > 0 
      ? Math.round((stepConfidences.reduce((a, b) => a + b, 0) / stepConfidences.length) * 100) / 100 
      : 0;

    const status = determineStatus(confidenceScore, enrichedItem);

    debugLog('[RUN] Computed confidenceScore:', confidenceScore, 'fieldConfidence:', fieldConfidence, 'status:', status);

    const { data: finalUpdate, error: finalError } = await getSupabaseAdmin()
      .from('items')
      .update({
        status,
        confidence_score: confidenceScore,
        field_confidence: fieldConfidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id)
      .select();

    debugJson('[RUN] Final status update:', { data: finalUpdate, error: finalError, count: finalUpdate?.length });

    await logEnrichment(supabase, item_id, 'orchestrator', hasErrors ? 'error' : 'success', hasErrors ? 'One or more steps failed' : null, { item_id }, { confidenceScore, fieldConfidence, status, steps: stepResults }, Date.now() - startTime);

    return NextResponse.json({
      success: !hasErrors,
      item_id,
      status,
      confidence_score: confidenceScore,
      field_confidence: fieldConfidence,
      step_results: stepResults,
      item: enrichedItem,
    });
  } catch (error) {
    debugError('Orchestrator error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


function determineStatus(confidenceScore: number, item: any): 'enriched' | 'review' {
  const criticalFields = ['manufacturer_name', 'brand_name', 'classpath'];
  const hasCritical = criticalFields.every(f => item[f]);
  if (!hasCritical) return 'review';
  if (confidenceScore < 60) return 'review';
  return 'enriched';
}
