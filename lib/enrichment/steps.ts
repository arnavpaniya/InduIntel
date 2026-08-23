/**
 * Shared enrichment step implementations — THE single source of truth.
 *
 * Used by:
 *   - POST /api/enrich/run            (in-process orchestration — no self-fetch)
 *   - POST /api/enrich/<step>         (thin HTTP wrappers)
 *
 * Every function talks to Supabase with the admin client (server-only) and
 * returns a StepResult instead of an HTTP response.
 */

import { createHash } from 'crypto';
import { Schema, SchemaType } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { callLLMWithRetry } from '@/lib/ai/gemini';
import { debugLog, debugError, debugJson } from '@/lib/debug';
import { detectMissingFields } from '@/lib/product-intelligence/missing-fields';

export interface StepResult<T = any> {
  success: boolean;
  data?: T;
  item?: any;
  cached?: boolean;
  count?: number;
  error?: string | null;
  /** safe, user-presentable message (no internals) */
  safeError?: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function getSafeError(backendError: string | null, defaultSafeMessage: string): string {
  if (!backendError) return defaultSafeMessage;
  if (backendError.includes('429')) return 'AI service rate limit reached.';
  if (backendError.includes('401') || backendError.includes('403')) return 'AI service authentication error.';
  if (backendError.includes('timeout') || backendError.includes('network') || backendError.includes('ECONNREFUSED')) return 'AI service network timeout.';
  return defaultSafeMessage;
}

function hashInput(input: any): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16);
}

async function getCachedResult(itemId: string, step: string, inputHash: string) {
  const { data } = await supabaseAdmin
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
  itemId: string,
  step: string,
  status: 'success' | 'error',
  error: string | null,
  input: any,
  output: any,
  durationMs: number,
  inputHash?: string,
) {
  let finalError = error;
  if (error && status === 'error') {
    const attempts = output?.attempts ?? 1;
    let code = 'UNKNOWN';
    const match = error.match(/status (\d{3})/);
    if (match) code = match[1];
    else if (error.includes('429')) code = '429';
    else if (error.includes('500')) code = '500';
    else if (error.includes('502')) code = '502';
    else if (error.includes('503')) code = '503';
    else if (error.includes('504')) code = '504';
    else if (error.includes('network') || error.includes('ECONNREFUSED')) code = 'NETWORK';
    else if (error.includes('timeout')) code = 'TIMEOUT';
    else if (error.includes('JSON parse error')) code = 'JSON_PARSE';

    finalError = `[${code}] Error after ${attempts} attempt(s): ${error}`;
  }

  const payload: any = {
    item_id: itemId,
    step,
    status,
    error: finalError,
    input_json: inputHash ? { ...input, _hash: inputHash } : input,
    output_json: output,
    duration_ms: durationMs,
  };
  await supabaseAdmin.from('enrichment_logs').insert(payload);
}

/**
 * Real Gemini usage accounting: every LLM attempt increments TODAY's row in
 * gemini_usage_log so GET /api/usage reflects reality (BUG 9 follow-up).
 * Counting failures never breaks the step.
 */
async function recordGeminiCall(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabaseAdmin
      .from('gemini_usage_log')
      .select('request_count')
      .eq('request_date', today)
      .maybeSingle();
    const next = (data?.request_count ?? 0) + 1;
    await supabaseAdmin
      .from('gemini_usage_log')
      .upsert({ request_date: today, request_count: next }, { onConflict: 'request_date' });
  } catch (err) {
    debugLog('[USAGE] counter update skipped:', err);
  }
}

/** callLLMWithRetry + honest usage accounting. */
async function callLLMCounted<T>(prompt: string, options: Parameters<typeof callLLMWithRetry<T>>[1]): Promise<ReturnType<typeof callLLMWithRetry<T>>> {
  // Pass recordGeminiCall as onAttempt so it's tracked for every try
  return await callLLMWithRetry<T>(prompt, options, 2, recordGeminiCall);
}

async function fetchItem(itemId: string, columns: string): Promise<{ item: any; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from('items')
    .select(columns)
    .eq('id', itemId)
    .maybeSingle();
  return { item: data as any, error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// manufacturer
// ---------------------------------------------------------------------------

const MANUFACTURER_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    manufacturer_name: { type: SchemaType.STRING, nullable: true },
    brand_name: { type: SchemaType.STRING, nullable: true },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
  },
  required: ['manufacturer_name', 'brand_name', 'confidence', 'reasoning'],
};

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

export async function runManufacturerStep(itemId: string): Promise<StepResult> {
  const startTime = Date.now();
  try {
    const { item, error: itemError } = await fetchItem(
      itemId,
      'id, mfg_part_num, part_desc, e1_brand, unilog_brand, dib_brand, part_manuf',
    );
    if (itemError) return { success: false, error: itemError };
    if (!item) return { success: false, error: 'Item not found' };

    const inputData = {
      mfg_part_num: item.mfg_part_num,
      part_desc: item.part_desc,
      part_manuf: item.part_manuf,
      e1_brand: item.e1_brand,
      unilog_brand: item.unilog_brand,
      dib_brand: item.dib_brand,
    };
    const inputHash = hashInput(inputData);

    const cached = await getCachedResult(itemId, 'manufacturer', inputHash);
    if (cached) {
      debugLog('[MANUFACTURER] Cache hit');
      await logEnrichment(itemId, 'manufacturer', 'success', null, inputData, cached, Date.now() - startTime, inputHash);
      const { data: updated } = await supabaseAdmin
        .from('items')
        .update({ manufacturer_name: cached.manufacturer_name, brand_name: cached.brand_name, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select();
      return { success: true, data: cached, item: updated?.[0], cached: true };
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

    if (item.mfg_part_num === 'XTP235') {
      debugLog('[DIAGNOSTIC XTP235] About to call Gemini with context:', {
        mfg_part_num: item.mfg_part_num,
        part_desc: item.part_desc,
        part_manuf: item.part_manuf,
        e1_brand: item.e1_brand,
        unilog_brand: item.unilog_brand,
        dib_brand: item.dib_brand,
      });
    }

    const result = await callLLMCounted<any>(prompt, { temperature: 0.1, responseSchema: MANUFACTURER_SCHEMA });
    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(itemId, 'manufacturer', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return { success: false, error: result.error || 'Failed to parse manufacturer', safeError: getSafeError(result.error, 'The AI could not read the manufacturer information for this product.') };
    }
    if (typeof result.data.confidence !== 'number' || isNaN(result.data.confidence)) {
      result.data.confidence = 0.8;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('items')
      .update({ manufacturer_name: result.data.manufacturer_name, brand_name: result.data.brand_name, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select();

    if (updateError) {
      await logEnrichment(itemId, 'manufacturer', 'error', updateError.message, inputData, result, duration, inputHash);
      return { success: false, error: updateError.message };
    }

    await logEnrichment(itemId, 'manufacturer', 'success', null, inputData, result.data, duration, inputHash);
    return { success: true, data: result.data, item: updated?.[0] };
  } catch (error) {
    debugError('[MANUFACTURER] step error:', error);
    return { success: false, error: String(error), safeError: 'Manufacturer cleaning failed unexpectedly.' };
  }
}

// ---------------------------------------------------------------------------
// classify
// ---------------------------------------------------------------------------

const CLASSIFY_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    dept: { type: SchemaType.STRING, nullable: true },
    class: { type: SchemaType.STRING, nullable: true },
    fine: { type: SchemaType.STRING, nullable: true },
    classpath: { type: SchemaType.STRING, nullable: true },
    confidence: { type: SchemaType.NUMBER },
    reasoning: { type: SchemaType.STRING },
  },
  required: ['dept', 'class', 'fine', 'classpath', 'confidence', 'reasoning'],
};

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

export async function runClassifyStep(itemId: string): Promise<StepResult> {
  const startTime = Date.now();
  try {
    const { item, error: itemError } = await fetchItem(
      itemId,
      'id, mfg_part_num, part_desc, manufacturer_name, brand_name',
    );
    if (itemError) return { success: false, error: itemError };
    if (!item) return { success: false, error: 'Item not found' };

    const inputData = {
      mfg_part_num: item.mfg_part_num,
      part_desc: item.part_desc,
      manufacturer_name: item.manufacturer_name,
      brand_name: item.brand_name,
    };
    const inputHash = hashInput(inputData);

    const cached = await getCachedResult(itemId, 'classify', inputHash);
    if (cached) {
      debugLog('[CLASSIFY] Cache hit');
      await logEnrichment(itemId, 'classify', 'success', null, inputData, cached, Date.now() - startTime, inputHash);
      const { data: updated } = await supabaseAdmin
        .from('items')
        .update({ dept: cached.dept, class: cached.class, fine: cached.fine, classpath: cached.classpath, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select();
      return { success: true, data: cached, item: updated?.[0], cached: true };
    }

    const prompt = `${CLASSIFY_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}

Return JSON only.`;

    const result = await callLLMCounted<any>(prompt, { temperature: 0.1, responseSchema: CLASSIFY_SCHEMA });
    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(itemId, 'classify', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return { success: false, error: result.error || 'Failed to parse classification', safeError: getSafeError(result.error, 'The AI could not classify this product.') };
    }
    if (typeof result.data.confidence !== 'number' || isNaN(result.data.confidence)) {
      result.data.confidence = 0.8;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('items')
      .update({ dept: result.data.dept, class: result.data.class, fine: result.data.fine, classpath: result.data.classpath, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select();

    if (updateError) {
      await logEnrichment(itemId, 'classify', 'error', updateError.message, inputData, result, duration, inputHash);
      return { success: false, error: updateError.message };
    }

    await logEnrichment(itemId, 'classify', 'success', null, inputData, result.data, duration, inputHash);
    return { success: true, data: result.data, item: updated?.[0] };
  } catch (error) {
    debugError('[CLASSIFY] step error:', error);
    return { success: false, error: String(error), safeError: 'Classification failed unexpectedly.' };
  }
}

// ---------------------------------------------------------------------------
// attributes
// ---------------------------------------------------------------------------

interface AttributeItem { label: string; value: string; uom: string | null }

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

function parseMeasurement(text: string): { value: string; uom: string } | null {
  const match = text.match(/^([\d.]+)\s*(\w+)$/);
  if (match) return { value: match[1], uom: match[2] };
  return null;
}

export async function runAttributesStep(itemId: string): Promise<StepResult> {
  const startTime = Date.now();
  try {
    const { item, error: itemError } = await fetchItem(
      itemId,
      'id, mfg_part_num, part_desc, manufacturer_name, brand_name, dept, class, fine, classpath',
    );
    if (itemError) return { success: false, error: itemError };
    if (!item) return { success: false, error: 'Item not found' };

    const inputData = {
      mfg_part_num: item.mfg_part_num,
      part_desc: item.part_desc,
      manufacturer_name: item.manufacturer_name,
      brand_name: item.brand_name,
      dept: item.dept,
      klass: item.class,
      fine: item.fine,
      classpath: item.classpath,
    };
    const inputHash = hashInput(inputData);

    let categoryContext = '';
    if (inputData.dept || inputData.klass || inputData.fine || inputData.classpath) {
      categoryContext = `\n\nCategory context:
- dept: ${inputData.dept || 'not specified'}
- class: ${inputData.klass || 'not specified'}
- fine: ${inputData.fine || 'not specified'}
- classpath: ${inputData.classpath || 'not specified'}
`;
    }

    // Pre-process part_desc: fractions -> decimals
    const fractionPattern = /(\d+)-(\d+)\/(\d+)|(\d+)\/(\d+)/g;
    const replaceFraction = (match: string, whole: unknown, wNum: unknown, wDenom: unknown, fNum: unknown, fDenom: unknown) => {
      if (whole && wNum && wDenom) {
        return String(parseInt(whole as string, 10) + parseInt(wNum as string, 10) / parseInt(wDenom as string, 10));
      }
      if (fNum && fDenom) {
        return String(parseInt(fNum as string, 10) / parseInt(fDenom as string, 10));
      }
      return match;
    };
    const processedPartDesc = item.part_desc ? item.part_desc.replace(fractionPattern, replaceFraction) : item.part_desc;

    const buildAttrs = (list: any[]) =>
      (list || [])
        .filter((a: any) => a.label && a.value)
        .slice(0, 50)
        .map((a: any, idx: number) => {
          let formattedValue = a.value;
          let formattedUom = a.uom;
          if (a.value && a.uom) {
            const parsed = parseMeasurement(`${a.value} ${a.uom}`);
            if (parsed) { formattedValue = parsed.value.toString(); formattedUom = parsed.uom; }
          }
          return { item_id: itemId, seq: idx + 1, label: a.label, value: formattedValue, uom: formattedUom };
        });

    const cached = await getCachedResult(itemId, 'attributes', inputHash);
    if (cached) {
      debugLog('[ATTRIBUTES] Cache hit');
      await logEnrichment(itemId, 'attributes', 'success', null, inputData, cached, Date.now() - startTime, inputHash);
      const validAttributes = buildAttrs(cached.attributes);
      if (validAttributes.length > 0) {
        await supabaseAdmin.from('item_attributes').delete().eq('item_id', itemId);
        await supabaseAdmin.from('item_attributes').insert(validAttributes);
      }
      return { success: true, data: cached, count: validAttributes.length, cached: true };
    }

    const prompt = `${ATTRIBUTES_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${processedPartDesc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}

${categoryContext}
Return JSON only.`;

    const result = await callLLMCounted<any>(prompt, { temperature: 0.1, responseSchema: ATTRIBUTES_SCHEMA });
    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(itemId, 'attributes', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return { success: false, error: result.error || 'Failed to parse attributes', safeError: getSafeError(result.error, 'Attribute extraction failed for this product.') };
    }
    if (typeof result.data.confidence !== 'number' || isNaN(result.data.confidence)) {
      result.data.confidence = 0.8;
    }

    const validAttributes = buildAttrs(result.data.attributes);

    if (validAttributes.length > 0) {
      await supabaseAdmin.from('item_attributes').delete().eq('item_id', itemId);
      const { error: attrError } = await supabaseAdmin
        .from('item_attributes')
        .insert(validAttributes);
      if (attrError) {
        await logEnrichment(itemId, 'attributes', 'error', attrError.message, inputData, result, duration, inputHash);
        return { success: false, error: attrError.message };
      }
    }

    await logEnrichment(itemId, 'attributes', 'success', null, inputData, result.data, duration, inputHash);
    return { success: true, data: result.data, count: validAttributes.length };
  } catch (error) {
    debugError('[ATTRIBUTES] step error:', error);
    return { success: false, error: String(error), safeError: 'Attribute extraction failed unexpectedly.' };
  }
}

// ---------------------------------------------------------------------------
// descriptions
// ---------------------------------------------------------------------------

interface DescriptionItem { field_name: string; value: string; char_count: number }

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

const DESCRIPTIONS_PROMPT = `Generate 6 standardized product description variants for industrial catalog use.

Rules:
1. invoice_desc: ≤40 chars, ALL CAPS, abbreviated, key specs only (e.g. "DISHWASHER LEG 5 SST 120V 15A 50-1/4IN")
2. mobile_desc: 60-80 chars, readable sentence fragment (e.g. "Rheem Manufacturing FRIGIDAIRE, Dishwasher, Professional Series, PDSH4816AF")
3. short_desc: brand + series + MPN + item type + 2-3 key attrs, ~100-150 chars (e.g. "FRIGIDAIRE® Professional Series PDSH4816AF Dishwasher With CleanBoost™, Leg Mounting, 5-Wash Cycle, Stainless Steel")
4. long_desc1: full sentence, attributes + dims + finish, ~200-400 chars
5. marketing_description: promotional tone, benefits-focused, ~150-300 chars (optional if not applicable)
6. retail_desc: retail storefront tone, benefits + key specs, ~100-200 chars (e.g. "The CMT 790.820 Planer Blade is a high-quality accessory designed for various planer applications. This set includes two durable blades, Model 790.820, ensuring efficient and precise material removal.")

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
    {"field_name": "marketing_description", "value": "...", "char_count": N},
    {"field_name": "retail_desc", "value": "...", "char_count": N}
  ],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

const MAX_LENGTHS: Record<string, number> = {
  invoice_desc: 40,
  mobile_desc: 80,
  short_desc: 180,
  long_desc1: 500,
  marketing_description: 350,
  retail_desc: 200,
};

function enforceLength(desc: DescriptionItem): DescriptionItem {
  const max = MAX_LENGTHS[desc.field_name] || 500;
  if (desc.value.length > max) {
    return { ...desc, value: desc.value.slice(0, max - 3) + '...', char_count: max };
  }
  return desc;
}

export async function runDescriptionsStep(itemId: string): Promise<StepResult> {
  const startTime = Date.now();
  try {
    const { item, error: itemError } = await fetchItem(
      itemId,
      'id, mfg_part_num, part_desc, manufacturer_name, brand_name, dept, class, fine, classpath',
    );
    if (itemError) return { success: false, error: itemError };
    if (!item) return { success: false, error: 'Item not found' };

    const { data: attrs } = await supabaseAdmin
      .from('item_attributes')
      .select('label, value, uom')
      .eq('item_id', itemId)
      .order('seq');

    const attrText = (attrs || []).map((a: any) => `${a.label}: ${a.value} ${a.uom || ''}`.trim()).join('; ');

    const inputData = {
      mfg_part_num: item.mfg_part_num,
      part_desc: item.part_desc,
      manufacturer_name: item.manufacturer_name,
      brand_name: item.brand_name,
      classpath: item.classpath,
      extracted_attributes: attrText || 'none',
    };
    const inputHash = hashInput(inputData);

    const cached = await getCachedResult(itemId, 'descriptions', inputHash);
    if (cached) {
      debugLog('[DESCRIPTIONS] Cache hit');
      await logEnrichment(itemId, 'descriptions', 'success', null, inputData, cached, Date.now() - startTime, inputHash);
      const processedDescriptions = (cached.descriptions || [])
        .map(enforceLength)
        .map((d: DescriptionItem) => ({ item_id: itemId, field_name: d.field_name, value: d.value, char_count: d.value.length }));
      if (processedDescriptions.length > 0) {
        await supabaseAdmin.from('item_descriptions').delete().eq('item_id', itemId);
        await supabaseAdmin.from('item_descriptions').insert(processedDescriptions);
      }
      return { success: true, data: cached, count: processedDescriptions.length, cached: true };
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

    const result = await callLLMCounted<any>(prompt, { temperature: 0.2, responseSchema: DESCRIPTIONS_SCHEMA });
    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(itemId, 'descriptions', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return { success: false, error: result.error || 'Failed to parse descriptions', safeError: getSafeError(result.error, 'Description generation failed for this product.') };
    }
    if (typeof result.data.confidence !== 'number' || isNaN(result.data.confidence)) {
      result.data.confidence = 0.8;
    }

    const processedDescriptions = (result.data.descriptions || [])
      .map(enforceLength)
      .map((d: DescriptionItem) => ({ item_id: itemId, field_name: d.field_name, value: d.value, char_count: d.value.length }));

    if (processedDescriptions.length > 0) {
      await supabaseAdmin.from('item_descriptions').delete().eq('item_id', itemId);
      const { error: descError } = await supabaseAdmin
        .from('item_descriptions')
        .insert(processedDescriptions);
      if (descError) {
        await logEnrichment(itemId, 'descriptions', 'error', descError.message, inputData, result, duration, inputHash);
        return { success: false, error: descError.message };
      }
    }

    await logEnrichment(itemId, 'descriptions', 'success', null, inputData, result.data, duration, inputHash);
    return { success: true, data: result.data, count: processedDescriptions.length };
  } catch (error) {
    debugError('[DESCRIPTIONS] step error:', error);
    return { success: false, error: String(error), safeError: 'Description generation failed unexpectedly.' };
  }
}

// ---------------------------------------------------------------------------
// specs
// ---------------------------------------------------------------------------

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
    'country_of_origin', 'warranty', 'confidence', 'reasoning',
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
  "length": number | null,
  "length_uom": "string or null",
  "width": number | null,
  "width_uom": "string or null",
  "height": number | null,
  "height_uom": "string or null",
  "weight": number | null,
  "weight_uom": "string or null",
  "country_of_origin": "string or null",
  "warranty": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

export async function runSpecsStep(itemId: string): Promise<StepResult> {
  const startTime = Date.now();
  try {
    const { item, error: itemError } = await fetchItem(
      itemId,
      'id, mfg_part_num, part_desc, manufacturer_name, brand_name',
    );
    if (itemError) return { success: false, error: itemError };
    if (!item) return { success: false, error: 'Item not found' };

    const { data: attrs } = await supabaseAdmin
      .from('item_attributes')
      .select('label, value, uom')
      .eq('item_id', itemId)
      .order('seq');

    const attrText = (attrs || []).map((a: any) => `${a.label}: ${a.value} ${a.uom || ''}`.trim()).join('; ');

    const inputData = {
      mfg_part_num: item.mfg_part_num,
      part_desc: item.part_desc,
      manufacturer_name: item.manufacturer_name,
      brand_name: item.brand_name,
      extracted_attributes: attrText || 'none',
    };
    const inputHash = hashInput(inputData);

    const cached = await getCachedResult(itemId, 'specs', inputHash);
    if (cached) {
      debugLog('[SPECS] Cache hit');
      await logEnrichment(itemId, 'specs', 'success', null, inputData, cached, Date.now() - startTime, inputHash);
      const { confidence: _c, reasoning: _r, ...specFields } = cached;
      await supabaseAdmin.from('item_specs').upsert({ item_id: itemId, ...specFields }, { onConflict: 'item_id' });
      return { success: true, data: cached, cached: true };
    }

    const prompt = `${SPECS_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}
- extracted_attributes: ${attrText || 'none'}

Return JSON only.`;

    const result = await callLLMCounted<any>(prompt, { temperature: 0.1, responseSchema: SPECS_SCHEMA });
    const duration = Date.now() - startTime;

    if (!result.data || result.error) {
      await logEnrichment(itemId, 'specs', 'error', result.error || 'No data', inputData, result, duration, inputHash);
      return { success: false, error: result.error || 'Failed to parse specs', safeError: getSafeError(result.error, 'Specification extraction failed for this product.') };
    }
    if (typeof result.data.confidence !== 'number' || isNaN(result.data.confidence)) {
      result.data.confidence = 0.8;
    }

    const { confidence: _c, reasoning: _r, ...specFields } = result.data;
    const { error: specError } = await supabaseAdmin
      .from('item_specs')
      .upsert({ item_id: itemId, ...specFields }, { onConflict: 'item_id' });

    if (specError) {
      await logEnrichment(itemId, 'specs', 'error', specError.message, inputData, result, duration, inputHash);
      return { success: false, error: specError.message };
    }

    await logEnrichment(itemId, 'specs', 'success', null, inputData, result.data, duration, inputHash);
    return { success: true, data: result.data };
  } catch (error) {
    debugError('[SPECS] step error:', error);
    return { success: false, error: String(error), safeError: 'Specification extraction failed unexpectedly.' };
  }
}

// ---------------------------------------------------------------------------
// missing-field analysis (deterministic, no LLM)
// ---------------------------------------------------------------------------

export interface MissingFieldAnalysis {
  neededFields: string[];
  skipFields: string[];
  rationale: string[];
}

export async function runMissingFieldAnalysisStep(itemId: string): Promise<StepResult<MissingFieldAnalysis>> {
  try {
    const { item, error } = await fetchItem(
      itemId,
      'id, mfg_part_num, part_desc, manufacturer_name, brand_name, dept, class, fine, classpath',
    );
    if (error) return { success: false, error };
    if (!item) return { success: false, error: 'Item not found' };

    const { data: specRow } = await supabaseAdmin
      .from('item_specs')
      .select('upc, ean, gtin, length, width, height, weight, warranty')
      .eq('item_id', itemId)
      .maybeSingle();

    const missingInfo = detectMissingFields({
      mfg_part_num: item.mfg_part_num ?? null,
      manufacturer_name: item.manufacturer_name ?? null,
      brand_name: item.brand_name ?? null,
      part_desc: item.part_desc ?? null,
      dept: item.dept ?? undefined,
      class: item.class ?? undefined,
      fine: item.fine ?? undefined,
      classpath: item.classpath ?? undefined,
      item_specs: specRow ?? {},
    });
    return {
      success: true,
      data: {
        neededFields: missingInfo.needed,
        skipFields: missingInfo.skip,
        rationale: missingInfo.rationale,
      },
    };
  } catch (error) {
    debugError('[MISSING-FIELDS] step error:', error);
    return { success: false, error: String(error) };
  }
}

// ---------------------------------------------------------------------------
// external evidence (Python service + optional single batched Gemini)
// Ported verbatim-in-spirit from the former HTTP-only implementation.
// ---------------------------------------------------------------------------

const EVIDENCE_SERVICE_URL = process.env.EVIDENCE_SERVICE_URL || '';
const EVIDENCE_TIMEOUT_MS = 15000;
const MAX_EVID = 300;

interface FieldProvenance {
  source_type: 'input' | 'inferred' | 'manufacturer' | 'distributor' | 'external' | 'unknown';
  source_url?: string;
  source_title?: string;
  evidence?: string;
  confidence?: number;
  retrieved_at: Date;
}

async function callPythonService(payload: {
  manufacturer: string; brand: string; mpn: string;
  description: string; category: string; missing_fields: string[];
}): Promise<any | null> {
  if (!EVIDENCE_SERVICE_URL) {
    debugLog('[EXTERNAL_EVIDENCE] EVIDENCE_SERVICE_URL not configured — skipping');
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EVIDENCE_TIMEOUT_MS);
  try {
    const resp = await fetch(`${EVIDENCE_SERVICE_URL.replace(/\/$/, '')}/evidence/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!resp.ok) {
      debugError(`[EXTERNAL_EVIDENCE] Python service HTTP ${resp.status}`);
      return null;
    }
    return await resp.json();
  } catch (err) {
    debugError('[EXTERNAL_EVIDENCE] Python service unreachable:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function hashIdentityKey(input: Record<string, unknown>): string {
  const stable = JSON.stringify(input, Object.keys(input).sort());
  let h = 0;
  for (let i = 0; i < stable.length; i++) h = ((h << 5) - h + stable.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

export async function runExternalEvidenceStep(itemId: string): Promise<StepResult> {
  const startTime = Date.now();
  try {
    const { item, error: itemError } = await fetchItem(
      itemId,
      'id, mfg_part_num, part_desc, manufacturer_name, brand_name, dept, class, fine, classpath',
    );
    if (itemError) return { success: false, error: itemError };
    if (!item) return { success: false, error: 'Item not found' };

    const { data: specRow } = await supabaseAdmin
      .from('item_specs')
      .select('upc, ean, gtin, length, width, height, weight, warranty')
      .eq('item_id', itemId)
      .maybeSingle();

    const missingInfo = detectMissingFields({
      mfg_part_num: item.mfg_part_num ?? null,
      manufacturer_name: item.manufacturer_name ?? null,
      brand_name: item.brand_name ?? null,
      part_desc: item.part_desc ?? null,
      dept: item.dept ?? undefined,
      class: item.class ?? undefined,
      fine: item.fine ?? undefined,
      classpath: item.classpath ?? undefined,
      item_specs: specRow ?? {},
    });

    if (missingInfo.needed.length === 0) {
      debugLog('[EXTERNAL_EVIDENCE] No fields need external lookup — skipping');
      return { success: true, data: { skipped: true, neededFields: [], evidence: [], provenance: {} } };
    }

    // ---- Cache check (identity-keyed, per-item row in enrichment_logs) ----
    const identityKey = hashIdentityKey({
      manufacturer: item.manufacturer_name ?? '',
      brand: item.brand_name ?? '',
      mpn: item.mfg_part_num ?? '',
      missing: [...missingInfo.needed].sort(),
    });

    const { data: cachedLog } = await supabaseAdmin
      .from('enrichment_logs')
      .select('output_json')
      .eq('item_id', itemId)
      .eq('step', 'external_evidence')
      .eq('status', 'success')
      .contains('input_json', { _identity_key: identityKey })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedLog?.output_json && typeof cachedLog.output_json === 'object') {
      debugLog('[EXTERNAL_EVIDENCE] Cache hit');
      return { success: true, data: { ...cachedLog.output_json, cached: true }, cached: true };
    }

    // ---- Call Python service ----------------------------------------------
    const pythonResult = await callPythonService({
      manufacturer: item.manufacturer_name ?? '',
      brand: item.brand_name ?? '',
      mpn: item.mfg_part_num ?? '',
      description: item.part_desc ?? '',
      category: item.classpath ?? '',
      missing_fields: missingInfo.needed,
    });

    if (!pythonResult || !pythonResult.success || !pythonResult.identity_match) {
      const resultPayload = {
        success: true,
        skipped: pythonResult === null,
        neededFields: missingInfo.needed,
        evidence: [],
        provenance: {},
        reject_reason: pythonResult?.reject_reason ?? 'evidence service unavailable or identity mismatch',
        unresolved: missingInfo.needed,
        durationMs: Date.now() - startTime,
      };
      await logEnrichment(itemId, 'external_evidence', 'success', null,
        { _identity_key: identityKey }, resultPayload, resultPayload.durationMs);
      return { success: true, data: resultPayload };
    }

    // ---- Deterministic fields -> provenance (NO Gemini) -------------------
    const provenance: Record<string, FieldProvenance> = {};
    const values: Record<string, unknown> = {};
    let deterministicCount = 0;

    for (const [field, d] of Object.entries(pythonResult.deterministic_fields ?? {}) as Array<[string, any]>) {
      values[field] = d.value;
      provenance[field] = {
        source_type: 'external',
        source_url: d.source_url,
        source_title: pythonResult.source?.title ?? '',
        evidence: d.evidence,
        confidence: d.confidence,
        retrieved_at: new Date(),
      };
      deterministicCount++;
    }

    // ---- Apply deterministic values to persisted specs ---------------------
    if (Object.keys(values).length > 0) {
      const specUpdate: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (['upc', 'ean', 'gtin', 'weight', 'length', 'width', 'height', 'warranty'].includes(k)) {
          specUpdate[k] = v;
          if (k === 'weight' && pythonResult.deterministic_fields[k]?.uom) specUpdate.weight_uom = pythonResult.deterministic_fields[k].uom;
          if (k === 'length' && pythonResult.deterministic_fields[k]?.uom) specUpdate.length_uom = pythonResult.deterministic_fields[k].uom;
          if (k === 'width' && pythonResult.deterministic_fields[k]?.uom) specUpdate.width_uom = pythonResult.deterministic_fields[k].uom;
          if (k === 'height' && pythonResult.deterministic_fields[k]?.uom) specUpdate.height_uom = pythonResult.deterministic_fields[k].uom;
        }
      }
      if (Object.keys(specUpdate).length > 0) {
        await supabaseAdmin.from('item_specs').upsert({ item_id: itemId, ...specUpdate }, { onConflict: 'item_id' });
      }
    }

    // ---- ONE batched Gemini call ONLY for ambiguous-but-evidenced fields ---
    const needsGemini: string[] = pythonResult.needs_gemini ?? [];
    const hasRetrievedEvidence =
      (pythonResult.evidence?.length ?? 0) > 0 ||
      Object.keys(pythonResult.deterministic_fields ?? {}).length > 0;

    if (needsGemini.length > 0 && hasRetrievedEvidence) {
      const sanitizedEvidence = (pythonResult.evidence as any[])
        .map((e) => `${e.field}: ${e.evidence}`).join('; ').slice(0, 2000);

      const prompt =
        'Extract product facts. Use ONLY the evidence below; ' +
        'return null for any field not supported by it. Never invent values.\n\n' +
        `Product: ${item.manufacturer_name ?? ''} ${item.mfg_part_num ?? ''}\n` +
        `Evidence: ${sanitizedEvidence}\n` +
        `Fields to resolve: ${needsGemini.join(', ')}\n\n` +
        'Return JSON: { "values": { "<field>": value|null, ... }, "confidence": 0.0-1.0 }';

      const llm = await callLLMCounted<{ values: Record<string, unknown>; confidence: number }>(
        prompt, { temperature: 0.1 },
      );

      if (llm.data && llm.data.values) {
        for (const field of needsGemini) {
          const v = llm.data.values[field];
          if (v !== null && v !== undefined && v !== '') {
            values[field] = v;
            provenance[field] = {
              source_type: 'inferred',
              source_url: pythonResult.source?.url,
              source_title: pythonResult.source?.title ?? '',
              evidence: sanitizedEvidence.slice(0, MAX_EVID),
              confidence: typeof llm.data.confidence === 'number' ? llm.data.confidence : 0.6,
              retrieved_at: new Date(),
            };
          }
        }
      }
    }

    const resultPayload = {
      success: true,
      skipped: false,
      neededFields: missingInfo.needed,
      identity_match: pythonResult.identity_match,
      source: pythonResult.source,
      evidence: values,
      provenance,
      needs_gemini: needsGemini,
      unresolved: pythonResult.unresolved ?? [],
      deterministicCount,
      durationMs: Date.now() - startTime,
    };

    await logEnrichment(itemId, 'external_evidence', 'success', null,
      { _identity_key: identityKey }, resultPayload, resultPayload.durationMs);

    return { success: true, data: resultPayload };
  } catch (error) {
    debugError('[EXTERNAL_EVIDENCE] step error:', error);
    // Never crash enrichment on external-evidence failure
    return {
      success: true,
      data: {
        success: true, skipped: true, neededFields: [], evidence: [], provenance: {},
        reject_reason: 'external evidence error', unresolved: [],
      },
      error: String(error),
    };
  }
}
