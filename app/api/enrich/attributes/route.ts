import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';
import { formatMeasurement, parseMeasurement } from '@/lib/ai/attributes';
import { createHash } from 'crypto';
import { debugLog, debugError, debugJson } from '@/lib/debug';
import { Schema, SchemaType } from '@google/generative-ai';

interface AttributeItem {
  label: string;
  value: string;
  uom: string | null;
}

interface AttributesResult {
  attributes: AttributeItem[];
  confidence: number;
  reasoning: string;
}

const ATTRIBUTES_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    attributes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING },
          uom: { type: SchemaType.STRING, nullable: true },
        },
        required: ['label', 'value', 'uom'],
      },
    },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
  },
  required: ['attributes', 'confidence', 'reasoning'],
};

const ATTRIBUTES_PROMPT = `Extract structured attributes from the product description. Output an array of {label, value, uom} objects.

Rules:
1. Only extract attributes explicitly stated or directly inferable from the description
2. Label: concise attribute name (Title Case)
3. Value: the attribute value as text
4. uom: unit of measure abbreviation if applicable (in, ft, mm, cm, lb, kg, V, A, W, dBA, RPM, psi) - null if not applicable
5. Max 50 attributes
6. NEVER invent values - if not in description, omit
7. For dimensions: extract as separate attributes (Length, Width, Height, Diameter, Thickness)
8. For electrical: Voltage Rating, Amperage Rating, Wattage
9. For sound: Sound Level (dBA)
10. For materials: Material, Finish, Color

Common labels to use when applicable:
- Series, Model, Number of Wash Cycles, Voltage Rating, Amperage Rating
- Mounting Type, Plug Type, Size, Depth With Door Open, Minimum Height
- Maximum Height, Sound Level, Material, Color, Additional Information
- Grit, Diameter, Thickness, Arbor Size, Max RPM, Application

Return ONLY valid JSON:
{
  "attributes": [{"label": "...", "value": "...", "uom": "..."}],
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

    debugLog('[ATTRIBUTES] Starting enrichment for item_id:', item_id);

    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, manufacturer_name, brand_name')
      .eq('id', item_id)
      .maybeSingle();

    debugLog('[ATTRIBUTES] Initial fetch - itemError:', itemError?.message, 'item found:', !!item);

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: 'Item not found', item_id }, { status: 404 });
    }

    const inputData = {
      mfg_part_num: item.mfg_part_num,
      part_desc: item.part_desc,
      manufacturer_name: item.manufacturer_name,
      brand_name: item.brand_name,
    };
    const inputHash = hashInput(inputData);

    // Check cache
    const cached = await getCachedResult(supabase, item_id, 'attributes', inputHash);
    if (cached) {
      debugLog('[ATTRIBUTES] Cache hit - returning cached result');
      const duration = Date.now() - startTime;
      await logEnrichment(supabase, item_id, 'attributes', 'success', null, inputData, cached, duration, inputHash);
      
      // Re-insert cached attributes
      const validAttributes = (cached.attributes || [])
        .filter((a: any) => a.label && a.value)
        .slice(0, 50)
        .map((a: any, idx: number) => {
          let formattedValue = a.value;
          let formattedUom = a.uom;
          
          if (a.value && a.uom) {
            const parsed = parseMeasurement(`${a.value} ${a.uom}`);
            if (parsed) {
              formattedValue = parsed.value.toString();
              formattedUom = parsed.uom;
            }
          }
          
          return {
            item_id: item_id,
            seq: idx + 1,
            label: a.label,
            value: formattedValue,
            uom: formattedUom,
          };
        });
      
      if (validAttributes.length > 0) {
        await supabaseAdmin.from('item_attributes').delete().eq('item_id', item_id);
        await supabaseAdmin.from('item_attributes').insert(validAttributes);
      }
      
      return NextResponse.json({ success: true, data: cached, count: validAttributes.length, cached: true });
    }

    const prompt = `${ATTRIBUTES_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}

Return JSON only.`;

    const result = await callLLMWithRetry<AttributesResult>(prompt, {
      temperature: 0.1,
      responseSchema: ATTRIBUTES_SCHEMA,
    });

    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(supabase, item_id, 'attributes', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return NextResponse.json({ error: result.error || 'Failed to parse attributes', data: result.data }, { status: 500 });
    }

    if (typeof result.data.confidence !== 'number' || isNaN(result.data.confidence)) {
      result.data.confidence = 0.8;
    }

    debugJson('[ATTRIBUTES] LLM result:', result.data);

    const validAttributes = (result.data.attributes || [])
      .filter((a: any) => a.label && a.value)
      .slice(0, 50)
      .map((a: any, idx: number) => {
        let formattedValue = a.value;
        let formattedUom = a.uom;
        
        if (a.value && a.uom) {
          const parsed = parseMeasurement(`${a.value} ${a.uom}`);
          if (parsed) {
            formattedValue = parsed.value.toString();
            formattedUom = parsed.uom;
          }
        }
        
        return {
          item_id: item_id,
          seq: idx + 1,
          label: a.label,
          value: formattedValue,
          uom: formattedUom,
        };
      });

    debugLog('[ATTRIBUTES] About to INSERT attributes, item_id:', item_id, 'count:', validAttributes.length);

    if (validAttributes.length > 0) {
      await supabaseAdmin.from('item_attributes').delete().eq('item_id', item_id);
      const { data: inserted, error: attrError } = await supabaseAdmin
        .from('item_attributes')
        .insert(validAttributes)
        .select();

      debugJson('[ATTRIBUTES] INSERT raw result:', {
        data: inserted,
        error: attrError,
        count: inserted?.length,
      });

      if (attrError) {
        await logEnrichment(supabase, item_id, 'attributes', 'error', attrError.message, inputData, result, duration, inputHash);
        return NextResponse.json({ error: attrError.message }, { status: 500 });
      }

      if (!inserted || inserted.length === 0) {
        await logEnrichment(supabase, item_id, 'attributes', 'error', 'Insert returned no rows', inputData, result, duration, inputHash);
        return NextResponse.json({ error: 'Insert returned no rows' }, { status: 500 });
      }

      debugLog('[ATTRIBUTES] Inserted attributes:', inserted);
    }

    await logEnrichment(supabase, item_id, 'attributes', 'success', null, inputData, result.data, duration, inputHash);

    return NextResponse.json({ success: true, data: result.data, count: validAttributes.length });
  } catch (error) {
    debugError('Attributes enrichment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
