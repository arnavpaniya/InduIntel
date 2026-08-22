import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { detectMissingFields } from '@/lib/product-intelligence/missing-fields';
import { geminiUsageTracker } from '@/lib/ai/external-retrieval';
import { callLLMWithRetry } from '@/lib/ai/gemini';
import { debugLog, debugError } from '@/lib/debug';

/** Provenance record shape (mirrors ProductFieldProvenance). */
interface FieldProvenance {
  source_type: 'input' | 'inferred' | 'manufacturer' | 'distributor' | 'external' | 'unknown';
  source_url?: string;
  source_title?: string;
  evidence?: string;
  confidence?: number;
  retrieved_at: Date;
}

/** Python evidence service response contract. */
interface PythonEvidenceItem {
  field: string;
  value: unknown;
  uom?: string;
  evidence: string;
  source_url: string;
  confidence: number;
}

interface PythonEvidenceResponse {
  success: boolean;
  needs_search: boolean;
  source: {
    url: string;
    title: string;
    domain: string;
    source_type: string;
    authority_tier: number;
    retrieved_at: string;
  } | null;
  identity_match: boolean;
  identity_confidence: number;
  reject_reason: string | null;
  evidence: PythonEvidenceItem[];
  deterministic_fields: Record<string, {
    value: unknown; uom?: string; evidence: string;
    source_url: string; confidence: number;
  }>;
  needs_gemini: string[];
  unresolved: string[];
}

interface ExternalEvidenceRequest {
  item_id: string;
  manufacturer: string | null;
  mpn: string | null;
  brand: string | null;
  description: string | null;
  categoryContext?: {
    dept?: string | null;
    class?: string | null;
    fine?: string | null;
    classpath?: string | null;
  };
}

const EVIDENCE_SERVICE_URL = process.env.EVIDENCE_SERVICE_URL || '';
const EVIDENCE_TIMEOUT_MS = 15000;

function hashInput(input: Record<string, unknown>): string {
  // Deterministic cache key covering product identity + request
  const stable = JSON.stringify(input, Object.keys(input).sort());
  let h = 0;
  for (let i = 0; i < stable.length; i++) {
    h = ((h << 5) - h + stable.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

async function callPythonService(payload: {
  manufacturer: string; brand: string; mpn: string;
  description: string; category: string; missing_fields: string[];
}): Promise<PythonEvidenceResponse | null> {
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
    return (await resp.json()) as PythonEvidenceResponse;
  } catch (err) {
    // Service unavailable / timeout must NOT crash enrichment
    debugError('[EXTERNAL_EVIDENCE] Python service unreachable:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const { item_id, manufacturer, mpn, brand, description, categoryContext } =
      body as ExternalEvidenceRequest;

    if (!item_id) {
      return NextResponse.json(
        { success: false, error: 'item_id required' }, { status: 400 });
    }

    geminiUsageTracker.recordProductTested();

    // ---- 1. Fetch current item state for missing-field analysis ----
    const supabase = await createServerSupabaseClient();
    const { data: item } = await supabase
      .from('items')
      .select('id, mfg_part_num, part_desc, manufacturer_name, brand_name, dept, class, fine, classpath')
      .eq('id', item_id)
      .maybeSingle();
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found', item_id }, { status: 404 });
    }

    // ---- 2. Deterministic missing-field analysis ----
    const { data: specRow } = await supabase
      .from('item_specs')
      .select('upc, ean, gtin, length, width, height, weight, warranty')
      .eq('item_id', item_id)
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
      return NextResponse.json({
        success: true, skipped: true,
        neededFields: [], evidence: [], provenance: {},
        reasoning: 'no missing fields worth external retrieval',
        durationMs: Date.now() - startTime,
      });
    }

    // ---- 3. Cache check in enrichment_logs (step=external_evidence) ----
    const identityKey = hashInput({
      manufacturer: item.manufacturer_name ?? '',
      brand: item.brand_name ?? '',
      mpn: item.mfg_part_num ?? '',
      missing: [...missingInfo.needed].sort(),
    });

    const { data: cachedLog } = await supabase
      .from('enrichment_logs')
      .select('output_json')
      .eq('item_id', item_id)
      .eq('step', 'external_evidence')
      .eq('status', 'success')
      .contains('input_json', { _identity_key: identityKey })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedLog?.output_json && typeof cachedLog.output_json === 'object') {
      geminiUsageTracker.recordCacheHit();
      const cached = cachedLog.output_json as Record<string, unknown>;
      return NextResponse.json({ ...cached, cached: true });
    }
    geminiUsageTracker.recordCacheMiss();

    // ---- 4. Call Python evidence service ----
    geminiUsageTracker.recordExternalSearch();
    const pythonResult = await callPythonService({
      manufacturer: item.manufacturer_name ?? '',
      brand: item.brand_name ?? '',
      mpn: item.mfg_part_num ?? '',
      description: item.part_desc ?? '',
      category: item.classpath ?? '',
      missing_fields: missingInfo.needed,
    });

    if (!pythonResult || !pythonResult.success || !pythonResult.identity_match) {
      // Preserve existing data; leave external fields unresolved; continue pipeline.
      return NextResponse.json({
        success: true, skipped: pythonResult === null,
        neededFields: missingInfo.needed,
        evidence: [], provenance: {},
        reject_reason: pythonResult?.reject_reason ?? 'evidence service unavailable or identity mismatch',
        unresolved: missingInfo.needed,
        durationMs: Date.now() - startTime,
      });
    }
    geminiUsageTracker.recordExternalRetrieval();

    // ---- 5. Deterministic fields -> provenance records (NO Gemini) ----
    const provenance: Record<string, FieldProvenance> = {};
    const values: Record<string, unknown> = {};
    let deterministicCount = 0;

    for (const [field, data] of Object.entries(pythonResult.deterministic_fields)) {
      values[field] = data.value;
      provenance[field] = {
        source_type: 'external',
        source_url: data.source_url,
        source_title: pythonResult.source?.title ?? '',
        evidence: data.evidence,
        confidence: data.confidence,
        retrieved_at: new Date(),
      };
      deterministicCount++;
    }
    geminiUsageTracker.recordDeterministicExtraction();
    if (deterministicCount > 0) {
      geminiUsageTracker.recordGeminiCallAvoided(); // one batched call avoided
    }

    // ---- 6. Gemini ONLY for ambiguous semantic fields with real evidence ----
    let geminiValues: Record<string, unknown> = {};
    const hasRetrievedEvidence = pythonResult.evidence.length > 0 ||
      Object.keys(pythonResult.deterministic_fields).length > 0;
    if (pythonResult.needs_gemini.length > 0 && hasRetrievedEvidence) {

      const sanitizedEvidence = pythonResult.evidence
        .map(e => `${e.field}: ${e.evidence}`).join('; ')
        .slice(0, 2000);

      const prompt =
        'Extract product facts. Use ONLY the evidence below; ' +
        'return null for any field not supported by it. Never invent values.\n\n' +
        `Product: ${item.manufacturer_name ?? ''} ${item.mfg_part_num ?? ''}\n` +
        `Evidence: ${sanitizedEvidence}\n` +
        `Fields to resolve: ${pythonResult.needs_gemini.join(', ')}\n\n` +
        'Return JSON: { "values": { "<field>": value|null, ... }, "confidence": 0.0-1.0 }';

      geminiUsageTracker.recordGeminiCall(); // ONE batched call, never per-field
      const llm = await callLLMWithRetry<{ values: Record<string, unknown>; confidence: number }>(
        prompt, { temperature: 0.1 });

      if (llm.data && llm.data.values) {
        for (const field of pythonResult.needs_gemini) {
          const v = llm.data.values[field];
          if (v !== null && v !== undefined) {
            geminiValues[field] = v;
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

    // ---- 7. Persist combined result in cache (enrichment_logs) ----
    const resultPayload = {
      success: true,
      skipped: false,
      neededFields: missingInfo.needed,
      identity_match: pythonResult.identity_match,
      source: pythonResult.source,
      evidence: values,
      provenance,
      needs_gemini: pythonResult.needs_gemini,
      unresolved: pythonResult.unresolved,
      durationMs: Date.now() - startTime,
    };

    await supabaseAdmin.from('enrichment_logs').insert({
      item_id,
      step: 'external_evidence',
      status: 'success',
      error: null,
      input_json: { _identity_key: identityKey },
      output_json: resultPayload,
      duration_ms: Date.now() - startTime,
    });

    return NextResponse.json(resultPayload);
  } catch (error) {
    debugError('[EXTERNAL_EVIDENCE] Unexpected error:', error);
    // Never crash the enrichment pipeline on external-evidence failure
    return NextResponse.json({
      success: false,
      error: 'External evidence enrichment error',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

const MAX_EVID = 300;

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'external-evidence',
    evidence_service_configured: Boolean(EVIDENCE_SERVICE_URL),
  });
}
