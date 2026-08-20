import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';
import { createHash } from 'crypto';
import { debugLog, debugError, debugJson } from '@/lib/debug';
import { Schema, SchemaType } from '@google/generative-ai';

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

const SPECS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    upc: { type: SchemaType.STRING, nullable: true },
    ean: { type: SchemaType.STRING, nullable: true },
    gtin: { type: SchemaType.STRING, nullable: true },
    unspsc: { type: SchemaType.STRING, nullable: true },
    list_price: { type: SchemaType.NUMBER, nullable: true },
    length: { type: SchemaType.NUMBER, nullable: true },
    length_uom: { type: SchemaType.STRING, nullable: true },
    width: { type: SchemaType.NUMBER, nullable: true },
    width_uom: { type: SchemaType.STRING, nullable: true },
    height: { type: SchemaType.NUMBER, nullable: true },
    height_uom: { type: SchemaType.STRING, nullable: true },
    weight: { type: SchemaType.NUMBER, nullable: true },
    weight_uom: { type: SchemaType.STRING, nullable: true },
    country_of_origin: { type: SchemaType.STRING, nullable: true },
    warranty: { type: SchemaType.STRING, nullable: true },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
  },
  required: [
    'upc', 'ean', 'gtin', 'unspsc', 'list_price',
    'length', 'length_uom', 'width', 'width_uom',
    'height', 'height_uom', 'weight', 'weight_uom',
    'country_of_origin', 'warranty', 'confidence', 'reasoning'
  ],
};

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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { item_id } = await request.json();
    if (!item_id) {
      return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    }

    debugLog('[SPECS] Starting enrichment for item_id:', item_id);

    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, manufacturer_name, brand_name')
      .eq('id', item_id)
      .maybeSingle();

    debugLog('[SPECS] Initial fetch - itemError:', itemError?.message, 'item found:', !!item);

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

    const inputData = {
      mfg_part_num: item.mfg_part_num,
      part_desc: item.part_desc,
      manufacturer_name: item.manufacturer_name,
      brand_name: item.brand_name,
      extracted_attributes: attrText || 'none',
    };
    const inputHash = hashInput(inputData);

    // Check cache
    const cached = await getCachedResult(supabase, item_id, 'specs', inputHash);
    if (cached) {
      debugLog('[SPECS] Cache hit - returning cached result');
      const duration = Date.now() - startTime;
      await logEnrichment(supabase, item_id, 'specs', 'success', null, inputData, cached, duration, inputHash);
      
      const specData = cached;
      const { confidence, reasoning, ...specFields } = specData;
      await supabaseAdmin
        .from('item_specs')
        .upsert({ item_id, ...specFields }, { onConflict: 'item_id' });
      
      return NextResponse.json({ success: true, data: cached, cached: true });
    }

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
      schema: SPECS_SCHEMA,
    });

    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(supabase, item_id, 'specs', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return NextResponse.json({ error: result.error || 'Failed to parse specs', data: result.data }, { status: 500 });
    }

    debugJson('[SPECS] LLM result:', result.data);

    const specData = result.data;
    const { confidence, reasoning, ...specFields } = specData;

    const { data: upserted, error: specError } = await supabaseAdmin
      .from('item_specs')
      .upsert({ item_id, ...specFields }, { onConflict: 'item_id' })
      .select();

    debugJson('[SPECS] UPSERT raw result:', {
      data: upserted,
      error: specError,
      count: upserted?.length,
    });

    if (specError) {
      await logEnrichment(supabase, item_id, 'specs', 'error', specError.message, inputData, result, duration, inputHash);
      return NextResponse.json({ error: specError.message }, { status: 500 });
    }

    if (!upserted || upserted.length === 0) {
      await logEnrichment(supabase, item_id, 'specs', 'error', 'Upsert returned no rows', inputData, result, duration, inputHash);
      return NextResponse.json({ error: 'Upsert returned no rows' }, { status: 500 });
    }

    debugLog('[SPECS] Upserted specs:', upserted);

    await logEnrichment(supabase, item_id, 'specs', 'success', null, inputData, result.data, duration, inputHash);

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    debugError('Specs enrichment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}