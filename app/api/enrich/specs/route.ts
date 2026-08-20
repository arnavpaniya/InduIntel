import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';

interface SpecsResult {
  upc: string | null;
  ean: string | null;
  gtin: string | null;
  unspsc: string | null;
  list_price: number | null;
  length: number | null;
  length_uom: string | null;
  width: number | null;
  width_uom: string | null;
  height: number | null;
  height_uom: string | null;
  weight: number | null;
  weight_uom: string | null;
  country_of_origin: string | null;
  warranty: string | null;
  confidence: number;
  reasoning: string;
}

const SPECS_PROMPT = `Extract product specifications from the description and attributes. ONLY include values explicitly stated or directly inferable.

Fields to extract if present:
- upc: 12-digit UPC code (only if explicitly in text)
- ean: 13-digit EAN code
- gtin: GTIN code
- unspsc: UNSPSC commodity code
- list_price: numeric price (only if explicitly stated)
- length/width/height: numeric dimensions with uom (in, ft, mm, cm)
- weight: numeric weight with uom (lb, kg, oz, g)
- country_of_origin: country name if stated
- warranty: warranty text if stated

Rules:
1. NEVER fabricate UPC, dimensions, or codes
2. If dimension is in description (e.g. "24 in W x 24-1/4 in D"), parse it
3. Convert fractional inches to decimal for storage (e.g. "24-1/4" → 24.25)
4. uom must be standard abbreviation
5. If not inferable, return null
6. Confidence based on how many fields filled from source text

Return ONLY valid JSON:
{
  "upc": "string or null",
  "ean": "string or null",
  "gtin": "string or null",
  "unspsc": "string or null",
  "list_price": number or null,
  "length": number or null,
  "length_uom": "string or null",
  "width": number or null,
  "width_uom": "string or null",
  "height": number or null,
  "height_uom": "string or null",
  "weight": number or null,
  "weight_uom": "string or null",
  "country_of_origin": "string or null",
  "warranty": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

function parseFractionalInches(text: string): number | null {
  const match = text.match(/(\d+)\s*-\s*(\d+)\/(\d+)/);
  if (match) {
    const whole = parseInt(match[1]);
    const num = parseInt(match[2]);
    const denom = parseInt(match[3]);
    return whole + num / denom;
  }
  const decimal = parseFloat(text);
  return isNaN(decimal) ? null : decimal;
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

    console.log('[SPECS] Starting enrichment for item_id:', item_id);

    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, manufacturer_name, brand_name')
      .eq('id', item_id)
      .maybeSingle();

    console.log('[SPECS] Initial fetch - itemError:', itemError?.message, 'item found:', !!item);

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: 'Item not found', item_id }, { status: 404 });
    }

    const { data: attrs } = await supabase
      .from('item_attributes')
      .select('label, value, uom')
      .eq('item_id', item_id)
      .order('seq');

    const attrText = (attrs || []).map(a => `${a.label}: ${a.value} ${a.uom || ''}`.trim()).join('; ');

    const prompt = `${SPECS_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}
- extracted_attributes: ${attrText || 'none'}

Return JSON only.`;

    const result = await callLLMWithRetry<SpecsResult>(prompt, {
      temperature: 0.1,
    });

    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(supabase, item_id, 'specs', 'error', result.error || 'No data', { item }, result, duration);
      return NextResponse.json({ error: result.error || 'Failed to parse specs', data: result.data }, { status: 500 });
    }

    console.log('[SPECS] LLM result:', JSON.stringify(result.data));

    const specData = result.data;
    const { confidence, reasoning, ...specFields } = specData;

    const { data: upserted, error: specError } = await supabaseAdmin
      .from('item_specs')
      .upsert({ item_id, ...specFields }, { onConflict: 'item_id' })
      .select();

    console.log('[SPECS] UPSERT raw result:', JSON.stringify({
      data: upserted,
      error: specError,
      count: upserted?.length,
    }, null, 2));

    if (specError) {
      await logEnrichment(supabase, item_id, 'specs', 'error', specError.message, { item }, result, duration);
      return NextResponse.json({ error: specError.message }, { status: 500 });
    }

    if (!upserted || upserted.length === 0) {
      await logEnrichment(supabase, item_id, 'specs', 'error', 'Upsert returned no rows', { item }, result, duration);
      return NextResponse.json({ error: 'Upsert returned no rows' }, { status: 500 });
    }

    console.log('[SPECS] Upserted specs:', upserted);

    await logEnrichment(supabase, item_id, 'specs', 'success', null, { item }, result.data, duration);

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Specs enrichment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}