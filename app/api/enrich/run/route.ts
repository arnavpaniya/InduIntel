import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { debugLog, debugJson } from '@/lib/debug';
import {
  runManufacturerStep,
  runClassifyStep,
  runMissingFieldAnalysisStep,
  runExternalEvidenceStep,
  runAttributesStep,
  runDescriptionsStep,
  runSpecsStep,
  type StepResult,
} from '@/lib/enrichment/steps';

/**
 * In-process orchestration. Steps are SHARED FUNCTIONS from
 * lib/enrichment/steps.ts — never self-referencing HTTP fetches
 * (which break on serverless/Vercel where localhost doesn't resolve).
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const incomingToken = request.headers.get('x-internal-api-token');
  const expectedToken = process.env.INTERNAL_API_TOKEN;
  if (expectedToken && incomingToken !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { item_id } = await request.json();
    if (!item_id) {
      return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    }

    debugLog('[RUN] Starting orchestration for item_id:', item_id);

    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, status')
      .eq('id', item_id)
      .maybeSingle();

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: 'Item not found', item_id }, { status: 404 });
    }

    // ---- Mark as enriching -------------------------------------------------
    await supabaseAdmin
      .from('items')
      .update({ status: 'enriching', updated_at: new Date().toISOString() })
      .eq('id', item_id);

    const stepResults: Record<string, any> = {};
    const stepConfidences: number[] = [];
    let failedStep: string | null = null;
    let failedError: string | null = null;

    const callShared = async (
      step: string,
      fn: () => Promise<StepResult>,
    ): Promise<StepResult> => {
      const stepStart = Date.now();
      debugLog(`[RUN] Step ${step} starting`);
      const result = await fn();
      const duration = Date.now() - stepStart;

      stepResults[step] = {
        success: result.success,
        ...(result.error ? { error: result.error } : {}),
        ...(result.safeError ? { safeError: result.safeError } : {}),
        data: result.data,
        cached: result.cached,
        count: result.count,
        duration,
      };

      if (result.success) {
        debugLog(`[RUN] Step ${step} succeeded in ${duration}ms`);
        const conf = (result.data as any)?.confidence;
        if (typeof conf === 'number') stepConfidences.push(conf);
      } else if (!failedStep) {
        failedStep = step;
        failedError = result.safeError ?? result.error ?? 'Unknown error';
        debugLog(`[RUN] Step ${step} FAILED: ${failedError}`);
      }
      return result;
    };

    // ---- Pipeline (in-process shared functions) ----------------------------
    await callShared('manufacturer', () => runManufacturerStep(item_id));

    let itemState: any = { ...item };
    let missingFields: string[] = [];

    if (!failedStep) {
      const classify = await callShared('classify', () => runClassifyStep(item_id));
      if (classify.item) {
        itemState = { ...itemState, ...classify.item };
      }
    }

    if (!failedStep) {
      const mf = await callShared('missing-field-analysis', () => runMissingFieldAnalysisStep(item_id));
      if (mf.data) {
        missingFields = mf.data.neededFields;
        itemState.missingFields = missingFields;
      }
    }

    if (!failedStep && missingFields.length > 0) {
      await callShared('external_evidence', () => runExternalEvidenceStep(item_id));
    } else if (!failedStep) {
      stepResults['external_evidence'] = {
        success: true, skipped: true, data: { evidence: [], neededFields: [] }, duration: 0,
      };
    }

    if (!failedStep) await callShared('attributes', () => runAttributesStep(item_id));
    if (!failedStep) await callShared('descriptions', () => runDescriptionsStep(item_id));
    if (!failedStep) await callShared('specs', () => runSpecsStep(item_id));

    // ---- Failure path: persist honest state ---------------------------------
    if (failedStep) {
      // Preferred: dedicated 'failed' lifecycle state (requires migration 011).
      const { error: failUpdateError } = await supabaseAdmin
        .from('items')
        .update({
          status: 'failed',
          failed_step: failedStep,
          failed_error: failedError,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item_id);

      let persistedStatus = 'failed';

      if (failUpdateError) {
        debugLog('[RUN] failed-state update rejected (migration 011 pending?):', failUpdateError.message);
        // Pre-migration fallback tier 1: review + failure metadata
        const { error: reviewErr } = await supabaseAdmin
          .from('items')
          .update({
            status: 'review',
            failed_step: failedStep,
            failed_error: failedError,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item_id);

        if (reviewErr) {
          // Tier 2 (schema lacks the new columns): still move OUT of
          // 'enriching' so no product lies about being in progress.
          const { error: basicErr } = await supabaseAdmin
            .from('items')
            .update({ status: 'review', updated_at: new Date().toISOString() })
            .eq('id', item_id);
          if (basicErr) {
            debugLog('[RUN] fallback basic write also failed:', basicErr.message);
          }
        }
        persistedStatus = 'review';
      }

      const { data: failedItem } = await supabase
        .from('items')
        .select(`*, item_descriptions(*), item_attributes(*), item_assets(*), item_specs(*)`)
        .eq('id', item_id)
        .maybeSingle();

      return NextResponse.json({
        success: false,
        item_id,
        status: 'failed',
        persisted_status: persistedStatus,
        failed_step: failedStep,
        failed_error: failedError,
        step_results: stepResults,
        item: failedItem ?? { id: item_id, status: persistedStatus, failed_step: failedStep },
      }, { status: 200 }); // 200: a handled business failure, not a transport error
    }

    // ---- Success path: compute confidence + final status --------------------
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

    if (fetchError || !enrichedItem) {
      return NextResponse.json(
        { error: fetchError?.message ?? 'Item not found after enrichment', item_id },
        { status: 500 },
      );
    }

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
          if ((enrichedItem as any)[field]) totalFilled++;
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
        totalFilled += Math.min(enrichedItem.item_attributes?.length || 0, minCount);
      } else if (req.table === 'item_specs' && req.fields) {
        const specObj = Array.isArray(enrichedItem.item_specs) ? enrichedItem.item_specs[0] : enrichedItem.item_specs;
        for (const field of req.fields!) {
          totalExpected++;
          if (specObj?.[field]) totalFilled++;
        }
      }
    }

    const confidenceScore = totalExpected > 0 ? Math.round((totalFilled / totalExpected) * 100) : 0;
    const fieldConfidence = stepConfidences.length > 0
      ? Math.round((stepConfidences.reduce((a, b) => a + b, 0) / stepConfidences.length) * 100) / 100
      : 0;

    const criticalFields = ['manufacturer_name', 'brand_name', 'classpath'];
    const hasCritical = criticalFields.every((f) => (enrichedItem as any)[f]);
    const status = !hasCritical ? 'review' : confidenceScore < 60 ? 'review' : 'enriched';

    debugLog('[RUN] Computed confidenceScore:', confidenceScore, 'fieldConfidence:', fieldConfidence, 'status:', status);

    await supabaseAdmin
      .from('items')
      .update({
        status,
        confidence_score: confidenceScore,
        field_confidence: fieldConfidence,
        failed_step: null,
        failed_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id);

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

    debugJson('[RUN] Final:', { status, confidenceScore });

    return NextResponse.json({
      success: true,
      item_id,
      status,
      confidence_score: confidenceScore,
      field_confidence: fieldConfidence,
      step_results: stepResults,
      item: finalEnrichedItem ?? {
        ...enrichedItem,
        status,
        confidence_score: confidenceScore,
        field_confidence: fieldConfidence,
      },
    });
  } catch (error) {
    debugLog('[RUN] Orchestration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
