import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';

interface ClassifyResult {
  dept: string | null;
  class: string | null;
  fine: string | null;
  classpath: string | null;
  confidence: number;
  reasoning: string;
}

const CLASSIFY_PROMPT = `You are classifying industrial products into a controlled taxonomy.

Given a product description and manufacturer, assign:
- dept: Top-level department (short, Title Case, e.g. "Appliances", "Tools", "Building Materials")
- class: Sub-category (short, Title Case, e.g. "Large Appliances", "Power Tools", "Decking")
- fine: Specific type (short, Title Case, e.g. "Dishwashers", "Circular Saws", "Composite Decking")
- classpath: Full path using ">" delimiter, matching style: "Dept > Class > Fine" or "Dept > Class > Fine > Subtype"

Rules:
1. Use short, controlled phrases - Title Case, no articles
2. Match the style seen in ground truth: "Appliances & Consumer Electronics > Kitchen Appliances > Built-In Dishwashers"
3. If uncertain, return null for that level
4. NEVER invent categories - only use what's inferable from description
5. Confidence based on clarity of match

Return ONLY valid JSON:
{
  "dept": "string or null",
  "class": "string or null",
  "fine": "string or null",
  "classpath": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

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

    console.log('[CLASSIFY] Starting enrichment for item_id:', item_id);

    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, manufacturer_name, brand_name')
      .eq('id', item_id)
      .maybeSingle();

    console.log('[CLASSIFY] Initial fetch - itemError:', itemError?.message, 'item found:', !!item);

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: 'Item not found', item_id }, { status: 404 });
    }

    const prompt = `${CLASSIFY_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}

Return JSON only.`;

    const result = await callLLMWithRetry<ClassifyResult>(prompt, {
      temperature: 0.1,
    });

    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(supabase, item_id, 'classify', 'error', result.error || 'No data', { item }, result, duration);
      return NextResponse.json({ error: result.error || 'Failed to parse classification', data: result.data }, { status: 500 });
    }

    console.log('[CLASSIFY] LLM result:', JSON.stringify(result.data));
    console.log('[CLASSIFY] About to UPDATE items with item_id:', item_id);
    console.log('[CLASSIFY] UPDATE payload:', JSON.stringify({
      dept: result.data.dept,
      class: result.data.class,
      fine: result.data.fine,
      classpath: result.data.classpath,
      confidence_score: result.data.confidence,
      updated_at: new Date().toISOString(),
    }, null, 2));

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('items')
      .update({
        dept: result.data.dept,
        class: result.data.class,
        fine: result.data.fine,
        classpath: result.data.classpath,
        confidence_score: result.data.confidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id)
      .select();

    console.log('[CLASSIFY] UPDATE raw result:', JSON.stringify({
      data: updated,
      error: updateError,
      count: updated?.length,
    }, null, 2));

    if (updateError) {
      await logEnrichment(supabase, item_id, 'classify', 'error', updateError.message, { item }, result, duration);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      await logEnrichment(supabase, item_id, 'classify', 'error', 'Update returned no rows', { item }, result, duration);
      return NextResponse.json({ error: 'Update returned no rows for item_id: ' + item_id }, { status: 404 });
    }

    const updatedItem = updated[0];
    console.log('[CLASSIFY] Updated item:', updatedItem);

    await logEnrichment(supabase, item_id, 'classify', 'success', null, { item }, result.data, duration);

    return NextResponse.json({ success: true, data: result.data, item: updatedItem });
  } catch (error) {
    console.error('Classification enrichment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}