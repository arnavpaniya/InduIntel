import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';
import { createHash } from 'crypto';

interface ManufacturerResult {
  manufacturer_name: string | null;
  brand_name: string | null;
  confidence: number;
  reasoning: string;
}

const MANUFACTURER_PROMPT = `You are normalizing manufacturer and brand names from industrial product data.

Input fields:
- part_manuf: raw manufacturer string from source (may contain parenthetical codes like "Freud Inc (2435)")
- e1_brand: E1 brand field (often placeholder "-- Unbranded --")
- unilog_brand: Unilog brand field (often placeholder "-- No Unilog Brand --")
- dib_brand: DIB brand field (often placeholder "-- No DIB Brand --")
- part_desc: product description text

Rules:
1. Extract the clean manufacturer name from part_manuf (strip parenthetical codes like "(2435)")
2. If part_manuf is empty, "-" or a known distributor/cooperative (e.g. "Appliance Dealers Cooperative (APPDE)"), use the actual manufacturer from the description or brand fields
3. Brand name comes from the most specific non-placeholder brand field, or infer from part_desc
4. If no reliable manufacturer/brand can be determined, return null for that field
5. NEVER invent or guess manufacturer names - only use what's in the input
6. Confidence: 0.9+ for clear matches, 0.5-0.8 for inferred, <0.5 for uncertain

Return ONLY valid JSON:
{
  "manufacturer_name": "string or null",
  "brand_name": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

function hashInput(input: any): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16);
}

async function getCachedResult(supabase: any, itemId: string, step: string, inputHash: string) {
  const { data } = await supabase
    .from('enrichment_logs')
    .select('output_json')
    .eq('item_id', itemId)
    .eq('step', step)
    .eq('status', 'success')
    .contains('input_json', { _hash: inputHash })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.output_json || null;
}

async function logEnrichment(
  supabase: any,
  itemId: string,
  step: string,
  status: 'success' | 'error',
  error: string | null,
  input: any,
  output: any,
  durationMs: number,
  inputHash: string
) {
  await supabase.from('enrichment_logs').insert({
    item_id: itemId,
    step,
    status,
    error,
    input_json: { ...input, _hash: inputHash },
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

    console.log('[MANUFACTURER] Starting enrichment for item_id:', item_id);

    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, e1_brand, unilog_brand, dib_brand, part_manuf')
      .eq('id', item_id)
      .maybeSingle();

    console.log('[MANUFACTURER] Initial fetch - itemError:', itemError?.message, 'item found:', !!item);

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: 'Item not found', item_id }, { status: 404 });
    }

    const inputData = {
      mfg_part_num: item.mfg_part_num,
      part_desc: item.part_desc,
      part_manuf: item.part_manuf,
      e1_brand: item.e1_brand,
      unilog_brand: item.unilog_brand,
      dib_brand: item.dib_brand,
    };
    const inputHash = hashInput(inputData);

    // Check cache
    const cached = await getCachedResult(supabase, item_id, 'manufacturer', inputHash);
    if (cached) {
      console.log('[MANUFACTURER] Cache hit - returning cached result');
      const duration = Date.now() - startTime;
      await logEnrichment(supabase, item_id, 'manufacturer', 'success', null, inputData, cached, duration, inputHash);
      
      // Still update the item with cached data
      const { data: updated } = await supabaseAdmin
        .from('items')
        .update({
          manufacturer_name: cached.manufacturer_name,
          brand_name: cached.brand_name,
          confidence_score: cached.confidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item_id)
        .select();
      
      return NextResponse.json({ success: true, data: cached, item: updated?.[0], cached: true });
    }

    const prompt = `${MANUFACTURER_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- part_manuf: ${item.part_manuf}
- e1_brand: ${item.e1_brand}
- unilog_brand: ${item.unilog_brand}
- dib_brand: ${item.dib_brand}

Return JSON only.`;

    const result = await callLLMWithRetry<ManufacturerResult>(prompt, {
      temperature: 0.1,
    });

    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(supabase, item_id, 'manufacturer', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return NextResponse.json({ error: result.error || 'Failed to parse manufacturer', data: result.data }, { status: 500 });
    }

    console.log('[MANUFACTURER] LLM result:', JSON.stringify(result.data));
    console.log('[MANUFACTURER] About to UPDATE items with item_id:', item_id);
    console.log('[MANUFACTURER] UPDATE payload:', JSON.stringify({
      manufacturer_name: result.data.manufacturer_name,
      brand_name: result.data.brand_name,
      confidence_score: result.data.confidence,
      updated_at: new Date().toISOString(),
    }, null, 2));

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('items')
      .update({
        manufacturer_name: result.data.manufacturer_name,
        brand_name: result.data.brand_name,
        confidence_score: result.data.confidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id)
      .select();

    console.log('[MANUFACTURER] UPDATE raw result:', JSON.stringify({
      data: updated,
      error: updateError,
      count: updated?.length,
    }, null, 2));

    if (updateError) {
      await logEnrichment(supabase, item_id, 'manufacturer', 'error', updateError.message, inputData, result, duration, inputHash);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
      await logEnrichment(supabase, item_id, 'manufacturer', 'error', 'Update returned no rows', inputData, result, duration, inputHash);
      return NextResponse.json({ error: 'Update returned no rows for item_id: ' + item_id }, { status: 404 });
    }

    const updatedItem = updated[0];
    console.log('[MANUFACTURER] Updated item:', updatedItem);

    await logEnrichment(supabase, item_id, 'manufacturer', 'success', null, inputData, result.data, duration, inputHash);

    return NextResponse.json({ success: true, data: result.data, item: updatedItem });
  } catch (error) {
    console.error('Manufacturer enrichment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}