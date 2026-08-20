// Load env first, before any other imports
import { config } from 'dotenv';
config({ path: '/Users/arnavpaniya/InduIntel/.env.local' });

// Set env vars explicitly before importing modules that use them
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || '';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Dynamically import modules that depend on env vars
let callLLMWithRetry: any;
let supabaseAdmin: any;

async function loadModules() {
  const [geminiMod, adminMod] = await Promise.all([
    import('../lib/ai/gemini'),
    import('../lib/supabase/admin'),
  ]);
  callLLMWithRetry = geminiMod.callLLMWithRetry;
  supabaseAdmin = adminMod.supabaseAdmin;
}

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

function hashInput(input: any): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16);
}

async function getCachedResult(itemId: string, step: string, inputHash: string) {
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

function parseMeasurement(text: string): { value: number; uom: string } | null {
  const match = text.match(/^([\d.]+)\s*(\w+)$/);
  if (match) {
    return { value: parseFloat(match[1]), uom: match[2] };
  }
  return null;
}

async function enrichManufacturer(itemId: string, item: any) {
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
    console.log('[MANUFACTURER] Cache hit');
    await logEnrichment(itemId, 'manufacturer', 'success', null, inputData, cached, 0, inputHash);
    await supabaseAdmin.from('items').update({
      manufacturer_name: cached.manufacturer_name,
      brand_name: cached.brand_name,
      confidence_score: cached.confidence,
      updated_at: new Date().toISOString(),
    }).eq('id', itemId);
    return cached;
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

  const startTime = Date.now();
  const result = await callLLMWithRetry<ManufacturerResult>(prompt, { temperature: 0.1 });
  const duration = Date.now() - startTime;

  if (!result.data || result.error) {
    await logEnrichment(itemId, 'manufacturer', 'error', result.error || 'No data', inputData, result, duration, inputHash);
    throw new Error(result.error || 'Failed to parse manufacturer');
  }

  console.log('[MANUFACTURER] LLM result:', JSON.stringify(result.data));

  await supabaseAdmin.from('items').update({
    manufacturer_name: result.data.manufacturer_name,
    brand_name: result.data.brand_name,
    confidence_score: result.data.confidence,
    updated_at: new Date().toISOString(),
  }).eq('id', itemId);

  await logEnrichment(itemId, 'manufacturer', 'success', null, inputData, result.data, duration, inputHash);
  return result.data;
}

async function enrichClassify(itemId: string, item: any) {
  const inputData = {
    mfg_part_num: item.mfg_part_num,
    part_desc: item.part_desc,
    manufacturer_name: item.manufacturer_name,
    brand_name: item.brand_name,
  };
  const inputHash = hashInput(inputData);

  const cached = await getCachedResult(itemId, 'classify', inputHash);
  if (cached) {
    console.log('[CLASSIFY] Cache hit');
    await logEnrichment(itemId, 'classify', 'success', null, inputData, cached, 0, inputHash);
    await supabaseAdmin.from('items').update({
      dept: cached.dept,
      class: cached.class,
      fine: cached.fine,
      classpath: cached.classpath,
      confidence_score: cached.confidence,
      updated_at: new Date().toISOString(),
    }).eq('id', itemId);
    return cached;
  }

  const prompt = `${CLASSIFY_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}

Return JSON only.`;

  const startTime = Date.now();
  const result = await callLLMWithRetry<ClassifyResult>(prompt, { temperature: 0.1 });
  const duration = Date.now() - startTime;

  if (!result.data || result.error) {
    await logEnrichment(itemId, 'classify', 'error', result.error || 'No data', inputData, result, duration, inputHash);
    throw new Error(result.error || 'Failed to parse classification');
  }

  console.log('[CLASSIFY] LLM result:', JSON.stringify(result.data));

  await supabaseAdmin.from('items').update({
    dept: result.data.dept,
    class: result.data.class,
    fine: result.data.fine,
    classpath: result.data.classpath,
    confidence_score: result.data.confidence,
    updated_at: new Date().toISOString(),
  }).eq('id', itemId);

  await logEnrichment(itemId, 'classify', 'success', null, inputData, result.data, duration, inputHash);
  return result.data;
}

async function enrichAttributes(itemId: string, item: any) {
  const inputData = {
    mfg_part_num: item.mfg_part_num,
    part_desc: item.part_desc,
    manufacturer_name: item.manufacturer_name,
    brand_name: item.brand_name,
  };
  const inputHash = hashInput(inputData);

  const cached = await getCachedResult(itemId, 'attributes', inputHash);
  if (cached) {
    console.log('[ATTRIBUTES] Cache hit');
    await logEnrichment(itemId, 'attributes', 'success', null, inputData, cached, 0, inputHash);
    
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
          item_id: itemId,
          seq: idx + 1,
          label: a.label,
          value: formattedValue,
          uom: formattedUom,
        };
      });
    
    if (validAttributes.length > 0) {
      await supabaseAdmin.from('item_attributes').delete().eq('item_id', itemId);
      await supabaseAdmin.from('item_attributes').insert(validAttributes);
    }
    return cached;
  }

  const prompt = `${ATTRIBUTES_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}

Return JSON only.`;

  const startTime = Date.now();
  const result = await callLLMWithRetry<AttributesResult>(prompt, { temperature: 0.1 });
  const duration = Date.now() - startTime;

  if (!result.data || result.error) {
    await logEnrichment(itemId, 'attributes', 'error', result.error || 'No data', inputData, result, duration, inputHash);
    throw new Error(result.error || 'Failed to parse attributes');
  }

  console.log('[ATTRIBUTES] LLM result:', JSON.stringify(result.data));

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
        item_id: itemId,
        seq: idx + 1,
        label: a.label,
        value: formattedValue,
        uom: formattedUom,
      };
    });

  if (validAttributes.length > 0) {
    await supabaseAdmin.from('item_attributes').delete().eq('item_id', itemId);
    await supabaseAdmin.from('item_attributes').insert(validAttributes);
  }

  await logEnrichment(itemId, 'attributes', 'success', null, inputData, result.data, duration, inputHash);
  return result.data;
}

async function enrichDescriptions(itemId: string, item: any) {
  const { data: attrs } = await supabase
    .from('item_attributes')
    .select('label, value, uom')
    .eq('item_id', itemId)
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

  const cached = await getCachedResult(itemId, 'descriptions', inputHash);
  if (cached) {
    console.log('[DESCRIPTIONS] Cache hit');
    await logEnrichment(itemId, 'descriptions', 'success', null, inputData, cached, 0, inputHash);
    
    const processedDescriptions = (cached.descriptions || [])
      .map(enforceLength)
      .map(d => ({
        item_id: itemId,
        field_name: d.field_name,
        value: d.value,
        char_count: d.value.length,
      }));
    
    if (processedDescriptions.length > 0) {
      await supabaseAdmin.from('item_descriptions').delete().eq('item_id', itemId);
      await supabaseAdmin.from('item_descriptions').insert(processedDescriptions);
    }
    return cached;
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

  const startTime = Date.now();
  const result = await callLLMWithRetry<DescriptionsResult>(prompt, { temperature: 0.2 });
  const duration = Date.now() - startTime;

  if (!result.data || result.error) {
    await logEnrichment(itemId, 'descriptions', 'error', result.error || 'No data', inputData, result, duration, inputHash);
    throw new Error(result.error || 'Failed to parse descriptions');
  }

  console.log('[DESCRIPTIONS] LLM result:', JSON.stringify(result.data));

  const processedDescriptions = (result.data.descriptions || [])
    .map(enforceLength)
    .map(d => ({
      item_id: itemId,
      field_name: d.field_name,
      value: d.value,
      char_count: d.value.length,
    }));

  if (processedDescriptions.length > 0) {
    await supabaseAdmin.from('item_descriptions').delete().eq('item_id', itemId);
    await supabaseAdmin.from('item_descriptions').insert(processedDescriptions);
  }

  await logEnrichment(itemId, 'descriptions', 'success', null, inputData, result.data, duration, inputHash);
  return result.data;
}

async function enrichSpecs(itemId: string, item: any) {
  const { data: attrs } = await supabase
    .from('item_attributes')
    .select('label, value, uom')
    .eq('item_id', itemId)
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

  const cached = await getCachedResult(itemId, 'specs', inputHash);
  if (cached) {
    console.log('[SPECS] Cache hit');
    await logEnrichment(itemId, 'specs', 'success', null, inputData, cached, 0, inputHash);
    
    const specData = cached;
    const { confidence, reasoning, ...specFields } = specData;
    await supabaseAdmin.from('item_specs').upsert({ item_id: itemId, ...specFields }, { onConflict: 'item_id' });
    return cached;
  }

  const prompt = `${SPECS_PROMPT}

Item data:
- mfg_part_num: ${item.mfg_part_num}
- part_desc: ${item.part_desc}
- manufacturer_name: ${item.manufacturer_name}
- brand_name: ${item.brand_name}
- extracted_attributes: ${attrText || 'none'}

Return JSON only.`;

  const startTime = Date.now();
  const result = await callLLMWithRetry<SpecsResult>(prompt, { temperature: 0.1 });
  const duration = Date.now() - startTime;

  if (!result.data || result.error) {
    await logEnrichment(itemId, 'specs', 'error', result.error || 'No data', inputData, result, duration, inputHash);
    throw new Error(result.error || 'Failed to parse specs');
  }

  console.log('[SPECS] LLM result:', JSON.stringify(result.data));

  const specData = result.data;
  const { confidence, reasoning, ...specFields } = specData;
  await supabaseAdmin.from('item_specs').upsert({ item_id: itemId, ...specFields }, { onConflict: 'item_id' });

  await logEnrichment(itemId, 'specs', 'success', null, inputData, result.data, duration, inputHash);
  return result.data;
}

async function runFullPipeline(itemId: string) {
  console.log(`\n🚀 Starting full enrichment pipeline for ${itemId}`);
  
  // Fetch item
  const { data: item, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', itemId)
    .maybeSingle();
  
  if (error || !item) {
    throw new Error(`Item not found: ${error?.message}`);
  }
  
  console.log(`📦 Item: ${item.mfg_part_num} - ${item.part_desc?.slice(0, 60)}...`);
  
  // Step 1: Manufacturer
  console.log('\n📝 Step 1/5: Manufacturer...');
  await enrichManufacturer(itemId, item);
  
  // Refresh item
  const { data: item2 } = await supabase.from('items').select('*').eq('id', itemId).maybeSingle();
  
  // Step 2: Classify
  console.log('\n📝 Step 2/5: Classify...');
  await enrichClassify(itemId, item2!);
  
  // Refresh item
  const { data: item3 } = await supabase.from('items').select('*').eq('id', itemId).maybeSingle();
  
  // Step 3: Attributes
  console.log('\n📝 Step 3/5: Attributes...');
  await enrichAttributes(itemId, item3!);
  
  // Step 4: Descriptions
  console.log('\n📝 Step 4/5: Descriptions...');
  await enrichDescriptions(itemId, item3!);
  
  // Step 5: Specs
  console.log('\n📝 Step 5/5: Specs...');
  await enrichSpecs(itemId, item3!);
  
  // Final status update
  const { data: finalItem } = await supabase.from('items').select('*').eq('id', itemId).maybeSingle();
  
  const requiredFields = [
    { table: 'items', fields: ['manufacturer_name', 'brand_name', 'dept', 'class', 'fine', 'classpath'] },
    { table: 'item_descriptions', fields: ['invoice_desc', 'mobile_desc', 'short_desc', 'long_desc1'] },
    { table: 'item_attributes', minCount: 5 },
    { table: 'item_specs', fields: ['upc', 'length', 'width', 'height', 'weight', 'warranty'] },
  ];

  let totalExpected = 0;
  let totalFilled = 0;

  for (const req of requiredFields) {
    if (req.table === 'items') {
      for (const field of req.fields) {
        totalExpected++;
        if (finalItem?.[field]) totalFilled++;
      }
    } else if (req.table === 'item_descriptions') {
      const { data: descs } = await supabase.from('item_descriptions').select('field_name, value').eq('item_id', itemId);
      const descMap = new Map(descs?.map(d => [d.field_name, d.value]) || []);
      for (const field of req.fields) {
        totalExpected++;
        if (descMap.get(field)) totalFilled++;
      }
    } else if (req.table === 'item_attributes') {
      const { data: attrs } = await supabase.from('item_attributes').select('*').eq('item_id', itemId);
      totalExpected += req.minCount;
      totalFilled += Math.min(attrs?.length || 0, req.minCount);
    } else if (req.table === 'item_specs') {
      const { data: specs } = await supabase.from('item_specs').select('*').eq('item_id', itemId).maybeSingle();
      for (const field of req.fields) {
        totalExpected++;
        if (specs?.[field]) totalFilled++;
      }
    }
  }

  const confidenceScore = totalExpected > 0 ? Math.round((totalFilled / totalExpected) * 100) : 0;
  
  const { data: logs } = await supabase
    .from('enrichment_logs')
    .select('output_json')
    .eq('item_id', itemId)
    .eq('status', 'success');
  
  const stepConfidences = (logs || [])
    .map(l => l.output_json?.confidence)
    .filter((c): c is number => typeof c === 'number');
  
  const fieldConfidence = stepConfidences.length > 0
    ? Math.round((stepConfidences.reduce((a, b) => a + b, 0) / stepConfidences.length) * 100) / 100
    : 0;

  const criticalFields = ['manufacturer_name', 'brand_name', 'classpath'];
  const hasCritical = criticalFields.every(f => finalItem?.[f]);
  const status = !hasCritical ? 'review' : confidenceScore < 60 ? 'review' : 'enriched';

  await supabaseAdmin.from('items').update({
    status,
    confidence_score: confidenceScore,
    field_confidence: fieldConfidence,
    updated_at: new Date().toISOString(),
  }).eq('id', itemId);

  console.log(`\n✅ Pipeline complete for ${itemId}`);
  console.log(`   Status: ${status}`);
  console.log(`   Confidence Score: ${confidenceScore}%`);
  console.log(`   Field Confidence: ${fieldConfidence}`);
  
  return { itemId, status, confidenceScore, fieldConfidence };
}

async function scoreItem(enrichedItemId: string, groundTruthItemId: string) {
  // Fetch enriched item
  const { data: enriched } = await supabase
    .from('items')
    .select('*, item_descriptions(*), item_attributes(*), item_specs(*)')
    .eq('id', enrichedItemId)
    .maybeSingle();
  
  // Fetch ground truth from ground_truth_* tables
  const { data: gtItem } = await supabase
    .from('ground_truth_items')
    .select('*')
    .eq('id', groundTruthItemId)
    .maybeSingle();
  
  const { data: gtDescs } = await supabase
    .from('ground_truth_descriptions')
    .select('*')
    .eq('item_id', groundTruthItemId);
  
  const { data: gtAttrs } = await supabase
    .from('ground_truth_attributes')
    .select('*')
    .eq('item_id', groundTruthItemId);
  
  const { data: gtSpecs } = await supabase
    .from('ground_truth_specs')
    .select('*')
    .eq('item_id', groundTruthItemId);
  
  const groundTruth = {
    ...gtItem,
    item_descriptions: gtDescs || [],
    item_attributes: gtAttrs || [],
    item_specs: gtSpecs || [],
  };

  // Import scoring logic
  const { scoreItem: score } = await import('../lib/scoring/compare');
  return score(enrichedItemId, groundTruthItemId);
}

async function main() {
  // Load modules that depend on env vars
  await loadModules();
  
  // Get ground truth item IDs
  const { data: gtItems } = await supabase
    .from('items')
    .select('id, mfg_part_num')
    .eq('is_ground_truth', true);
  
  console.log('🎯 Ground truth items to process:');
  gtItems?.forEach(item => console.log(`  - ${item.mfg_part_num} (${item.id})`));
  
  for (const gtItem of gtItems || []) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${gtItem.mfg_part_num}`);
    console.log(`${'='.repeat(60)}`);
    
    await runFullPipeline(gtItem.id);
    
    // Score against ground truth
    console.log('\n📊 Scoring against ground truth...');
    const score = await scoreItem(gtItem.id, gtItem.id); // This will use ground_truth_* tables
    console.log(`\n📈 Score Result:`);
    console.log(`   Overall Accuracy: ${score.overall_accuracy_pct}%`);
    console.log(`   Matched Fields: ${score.matched_fields}/${score.total_fields}`);
    
    // Show field-by-field breakdown
    console.log('\n📋 Field-by-field breakdown:');
    for (const fs of score.field_scores) {
      const icon = fs.match_type === 'exact_match' ? '✅' : fs.match_type === 'close_match' ? '⚠️' : '❌';
      console.log(`   ${icon} ${fs.field_name}: ${fs.match_type} (expected: "${fs.expected}", actual: "${fs.actual}")`);
    }
  }
  
  console.log('\n🏁 All done!');
}

main().catch(console.error);