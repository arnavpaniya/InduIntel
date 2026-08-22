import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { debugLog, debugError, debugJson } from '@/lib/debug';
import { detectMissingFields } from '@/lib/product-intelligence/missing-fields';
import { geminiUsageTracker } from '@/lib/ai/external-retrieval';

const ENRICHMENT_STEPS = [
  'manufacturer',
  'classify',
  // Optional step: missing-field analysis + conditional external evidence
  // Inserted after classify if fields are identified as needing external evidence
  // This preserves backward compatibility — if no fields need external lookup,
  // the step is skipped and the pipeline continues as before.
  'missing-field-analysis',
  'external_evidence',
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
  const incomingToken = request.headers.get('x-internal-api-token');
  const expectedToken = process.env.INTERNAL_API_TOKEN;
  if (expectedToken && incomingToken !== expectedToken) {
    debugError('[RUN] Unauthorized: invalid or missing internal API token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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
    const { data: statusData, error: statusError } = await supabaseAdmin
      .from('items')
      .update({ status: 'enriching', updated_at: new Date().toISOString() })
      .eq('id', item_id)
      .select();

    debugJson('[RUN] Status update result:', { data: statusData, error: statusError, count: statusData?.length });

    const stepResults: Record<string, any> = {};
    let hasErrors = false;
    const stepConfidences: number[] = [];

    // Track item state through the pipeline
    let itemState: any = { ...item }; // start with raw item data

    for (const step of ENRICHMENT_STEPS) {
      const stepStart = Date.now();
      
      // ---- Missing-field analysis: runs after classify to determine
      //         which fields need external evidence ----
      if (step === 'missing-field-analysis') {
        try {
          debugLog('[RUN] Running missing-field analysis after classify');
          // detectMissingFields uses item taxonomy + existing values
          // to determine which fields are worth external lookup
          const missingInfo = detectMissingFields(itemState);
          
          stepResults[step] = {
            success: true,
            data: {
              neededFields: missingInfo.needed,
              skipFields: missingInfo.skip,
              rationale: missingInfo.rationale,
            },
            duration: Date.now() - stepStart,
          };
          
          // Store the missing field info in itemState for the external_evidence step
          itemState.missingFields = missingInfo.needed;
          itemState.missingFieldRationale = missingInfo.rationale;
          
          debugLog('[RUN] Missing-field analysis complete - needed:', missingInfo.needed);
        } catch (error) {
          hasErrors = true;
          stepResults[step] = { success: false, error: String(error), duration: Date.now() - stepStart };
          debugError(`[RUN] Missing-field analysis exception:`, error);
          itemState.missingFields = [];
        }
        // Continue to next step regardless
        continue;
      }
      
      // ---- External evidence step: conditional, only runs if missing fields identified ----
      if (step === 'external_evidence') {
        // If no missing fields were identified, skip this step
        if (!itemState.missingFields || itemState.missingFields.length === 0) {
          debugLog('[RUN] Skipping external_evidence: no missing fields identified');
          stepResults[step] = {
            success: true,
            data: { evidence: [], neededFields: [] },
            duration: 0,
          };
          // Continue to attributes step
          // Note: we do NOT decrement stepStart here since we're in the loop
          // The loop will just continue; we need to account for the time
          // But since we're using continue, we should still track it
          // Let's just record a successful no-op
          continue;
        }
        
        debugLog('[RUN] Running external_evidence for fields:', itemState.missingFields);
        try {
          const result = await callStep('external_evidence', item_id, baseUrl);
          stepResults[step] = { success: true, data: result, duration: Date.now() - stepStart };
          
          if (!result.success) {
            hasErrors = true;
            debugError(`[RUN] external_evidence step failed:`, result.error);
          } else {
            debugLog('[RUN] external_evidence step succeeded in', Date.now() - stepStart, 'ms');
            // Store the evidence results into itemState for downstream use
            if (result.data && result.data.evidence) {
              itemState.externalEvidence = result.data.evidence;
            }
            // Update stepConfidences if available
            if (result.data && typeof result.data.confidence === 'number') {
              stepConfidences.push(result.data.confidence);
            }
          }
        } catch (error) {
          hasErrors = true;
          stepResults[step] = { success: false, error: String(error), duration: Date.now() - stepStart };
          debugError(`[RUN] external_evidence step exception:`, error);
        }
        // Continue to attributes step
        continue;
      }
      
      // ---- Normal step execution for all other steps ----
      try {
        debugLog(`[RUN] Calling step: ${step}`);
        const result = await callStep(step, item_id, baseUrl);
        stepResults[step] = { success: true, data: result, duration: Date.now() - stepStart };
        
        if (!result.success) {
          hasErrors = true;
          debugError(`[RUN] Step ${step} failed:`, result.error);
        } else {
          debugLog(`[RUN] Step ${step} succeeded in ${Date.now() - stepStart}ms`);
          
          // Update itemState with data from steps that populate item fields
          if (step === 'classify' && result.data) {
            // Store classify results (dept, class, fine, classpath)
            if (result.data.dept) itemState.dept = result.data.dept;
            if (result.data.class) itemState.class = result.data.class;
            if (result.data.fine) itemState.fine = result.data.fine;
            if (result.data.classpath) itemState.classpath = result.data.classpath;
            debugLog('[RUN] Classify results stored in itemState');
          }
          
          if (step === 'attributes' && result.data) {
            // Store attributes results
            if (result.data.data && result.data.data.attributes) {
              itemState.item_attributes = result.data.data.attributes;
            }
            debugLog('[RUN] Attributes results stored in itemState');
          }
          
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

    // Fetch enriched item with all relations
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

    debugLog('[RUN] Fetch enriched item - fetchError:', fetchError?.message, 'item found:', !!enrichedItem);

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
        const minCount = req.minCount ?? 0;
        totalExpected += minCount;
        const count = enrichedItem.item_attributes?.length || 0;
        totalFilled += Math.min(count, minCount);
      } else if (req.table === 'item_specs' && req.fields) {
        const specObj = Array.isArray(enrichedItem.item_specs) ? enrichedItem.item_specs[0] : enrichedItem.item_specs;
        for (const field of req.fields) {
          totalExpected++;
          if (specObj?.[field]) totalFilled++;
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

    const { data: finalUpdate, error: finalError } = await supabaseAdmin
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

    // Fetch complete final enriched item with all relations & updated scores
    const { data: finalEnrichedItem } = await supabase
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

    await logEnrichment(supabase, item_id, 'orchestrator', hasErrors ? 'error' : 'success', hasErrors ? 'One or more steps failed' : null, { item_id }, { confidenceScore, fieldConfidence, status, steps: stepResults }, Date.now() - startTime);

    return NextResponse.json({
      success: !hasErrors,
      item_id,
      status,
      confidence_score: confidenceScore,
      field_confidence: fieldConfidence,
      step_results: stepResults,
      item: finalEnrichedItem || {
        ...enrichedItem,
        status,
        confidence_score: confidenceScore,
        field_confidence: fieldConfidence,
      },
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
