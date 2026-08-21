import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';
import { createHash } from 'crypto';
import { debugLog, debugError, debugJson } from '@/lib/debug';
import { Schema, SchemaType } from '@google/generative-ai';

interface DescriptionItem {
  field_name: string;
  value: string;
  char_count: number;
}

interface DescriptionsResult {
  descriptions: DescriptionItem[];
  confidence: number;
  reasoning: string;
}

const DESCRIPTIONS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    descriptions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          field_name: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING },
          char_count: { type: SchemaType.INTEGER },
        },
        required: ['field_name', 'value', 'char_count'],
      },
    },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
  },
  required: ['descriptions', 'confidence', 'reasoning'],
};

const DESCRIPTIONS_PROMPT = `Generate 5 standardized product description variants for industrial catalog use.

Rules:
1. invoice_desc: ≤40 chars, ALL CAPS, abbreviated, key specs only (e.g. "DISHWASHER LEG 5 SST 120V 15A 50-1/4IN")
2. mobile_desc: 60-80 chars, readable sentence fragment (e.g. "Rheem Manufacturing FRIGIDAIRE, Dishwasher, Professional Series, PDSH4816AF")
3. short_desc: brand + series + MPN + item type + 2-3 key attrs, ~100-150 chars (e.g. "FRIGIDAIRE® Professional Series PDSH4816AF Dishwasher With CleanBoost™, Leg Mounting, 5-Wash Cycle, Stainless Steel")
4. long_desc1: full sentence, attributes + dims + finish, ~200-400 chars
5. marketing_description: promotional tone, benefits-focused, ~150-300 chars (optional if not applicable)

Constraints:
- Use only info from input - NEVER invent specs
- Enforce char limits in your response
- If a field cannot be generated, omit it
- Ground truth style: professional, catalog-ready

Return ONLY valid JSON:
{
  "descriptions": [
    {"field_name": "invoice_desc", "value": "...", "char_count": N},
    {"field_name": "mobile_desc", "value": "...", "char_count": N},
    {"field_name": "short_desc", "value": "...", "char_count": N},
    {"field_name": "long_desc1", "value": "...", "char_count": N},
    {"field_name": "marketing_description", "value": "...", "char_count": N}
  ],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

const MAX_LENGTHS = {
  invoice_desc: 40,
  mobile_desc: 80,
  short_desc: 180,
  long_desc1: 500,
  marketing_description: 350,
};

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

function enforceLength(desc: DescriptionItem): DescriptionItem {
  const max = MAX_LENGTHS[desc.field_name as keyof typeof MAX_LENGTHS] || 500;
  if (desc.value.length > max) {
    return {
      ...desc,
      value: desc.value.slice(0, max - 3) + '...',
      char_count: max,
    };
  }
  return desc;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { item_id } = await request.json();
    if (!item_id) {
      return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    }

    debugLog('[DESCRIPTIONS] Starting enrichment for item_id:', item_id);

    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, manufacturer_name, brand_name, dept, class, fine, classpath')
      .eq('id', item_id)
      .maybeSingle();

    debugLog('[DESCRIPTIONS] Initial fetch - itemError:', itemError?.message, 'item found:', !!item);

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
      classpath: item.classpath,
      extracted_attributes: attrText || 'none',
    };
    const inputHash = hashInput(inputData);

    // Check cache
    const cached = await getCachedResult(supabase, item_id, 'descriptions', inputHash);
    if (cached) {
      debugLog('[DESCRIPTIONS] Cache hit - returning cached result');
      const duration = Date.now() - startTime;
      await logEnrichment(supabase, item_id, 'descriptions', 'success', null, inputData, cached, duration, inputHash);
      
      const processedDescriptions = (cached.descriptions || [])
        .map(enforceLength)
        .map((d: { field_name: string; value: string; char_count: number }) => ({
          item_id,
          field_name: d.field_name,
          value: d.value,
          char_count: d.value.length,
        }));
      
      if (processedDescriptions.length > 0) {
        await supabaseAdmin.from('item_descriptions').delete().eq('item_id', item_id);
        await supabaseAdmin.from('item_descriptions').insert(processedDescriptions);
      }
      
      return NextResponse.json({ success: true, data: cached, count: processedDescriptions.length, cached: true });
    }

    const prompt = `${DESCRIPTIONS_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}
- classpath: ${item.classpath}
- extracted_attributes: ${attrText || 'none'}

Return JSON only.`;

    const result = await callLLMWithRetry<DescriptionsResult>(prompt, {
      temperature: 0.2,
      responseSchema: DESCRIPTIONS_SCHEMA,
    });

    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(supabase, item_id, 'descriptions', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return NextResponse.json({ error: result.error || 'Failed to parse descriptions', data: result.data }, { status: 500 });
    }

    if (typeof result.data.confidence !== 'number' || isNaN(result.data.confidence)) {
      result.data.confidence = 0.8;
    }

    debugJson('[DESCRIPTIONS] LLM result:', result.data);

    const processedDescriptions = (result.data.descriptions || [])
      .map(enforceLength)
      .map(d => ({
        item_id,
        field_name: d.field_name,
        value: d.value,
        char_count: d.value.length,
      }));

    debugLog('[DESCRIPTIONS] Processed descriptions with char_counts:');
    for (const d of processedDescriptions) {
      debugLog(`  ${d.field_name}: ${d.char_count} chars - "${d.value.slice(0, 60)}..."`);
    }

    if (processedDescriptions.length > 0) {
      await supabaseAdmin.from('item_descriptions').delete().eq('item_id', item_id);
      const { data: inserted, error: descError } = await supabaseAdmin
        .from('item_descriptions')
        .insert(processedDescriptions)
        .select();

      debugJson('[DESCRIPTIONS] INSERT raw result:', {
        data: inserted,
        error: descError,
        count: inserted?.length,
      });

      if (descError) {
        await logEnrichment(supabase, item_id, 'descriptions', 'error', descError.message, inputData, result, duration, inputHash);
        return NextResponse.json({ error: descError.message }, { status: 500 });
      }
    }

    await logEnrichment(supabase, item_id, 'descriptions', 'success', null, inputData, result.data, duration, inputHash);

    return NextResponse.json({ success: true, data: result.data, count: processedDescriptions.length });
  } catch (error) {
    debugError('Descriptions enrichment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
