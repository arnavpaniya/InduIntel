import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';
import { formatMeasurement, parseMeasurement } from '@/lib/ai/attributes';

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

    console.log('[ATTRIBUTES] Starting enrichment for item_id:', item_id);

    const supabase = await createServerSupabaseClient();

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, manufacturer_name, brand_name')
      .eq('id', item_id)
      .maybeSingle();

    console.log('[ATTRIBUTES] Initial fetch - itemError:', itemError?.message, 'item found:', !!item);

    if (itemError) {
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: 'Item not found', item_id }, { status: 404 });
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
    });

    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(supabase, item_id, 'attributes', 'error', result.error || 'No data', { item }, result, duration);
      return NextResponse.json({ error: result.error || 'Failed to parse attributes', data: result.data }, { status: 500 });
    }

    console.log('[ATTRIBUTES] LLM result:', JSON.stringify(result.data));

    const validAttributes = (result.data.attributes || [])
      .filter((a: any) => a.label && a.value)
      .slice(0, 50)
      .map((a: any, idx: number) => {
        // Enforce "number space abbreviation" format in code
        let formattedValue = a.value;
        let formattedUom = a.uom;
        
        // If value contains a number and uom is present, try to parse and reformat
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

    console.log('[ATTRIBUTES] About to INSERT attributes, item_id:', item_id, 'count:', validAttributes.length);

    if (validAttributes.length > 0) {
      await supabaseAdmin.from('item_attributes').delete().eq('item_id', item_id);
      const { data: inserted, error: attrError } = await supabaseAdmin
        .from('item_attributes')
        .insert(validAttributes)
        .select();

      console.log('[ATTRIBUTES] INSERT raw result:', JSON.stringify({
        data: inserted,
        error: attrError,
        count: inserted?.length,
      }, null, 2));

      if (attrError) {
        await logEnrichment(supabase, item_id, 'attributes', 'error', attrError.message, { item }, result, duration);
        return NextResponse.json({ error: attrError.message }, { status: 500 });
      }

      if (!inserted || inserted.length === 0) {
        await logEnrichment(supabase, item_id, 'attributes', 'error', 'Insert returned no rows', { item }, result, duration);
        return NextResponse.json({ error: 'Insert returned no rows' }, { status: 500 });
      }

      console.log('[ATTRIBUTES] Inserted attributes:', inserted);
    }

    await logEnrichment(supabase, item_id, 'attributes', 'success', null, { item }, result.data, duration);

    return NextResponse.json({ success: true, data: result.data, count: validAttributes.length });
  } catch (error) {
    console.error('Attributes enrichment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}