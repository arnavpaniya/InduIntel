/**
 * Enrichment Pipeline Orchestrator (Stage 5, Parts 4 + 8–12 + 18 + 19)
 *
 * Composes the existing, verified stages into one robust flow:
 *
 *   normalized input -> identity -> duplicate detection ->
 *   missing-field analysis -> Python evidence service (when justified) ->
 *   deterministic extraction application -> conflict resolution ->
 *   Gemini ONLY when necessary (single batched call) -> CanonicalProduct
 *
 * Hard guarantees:
 * - Failure isolation: an error on any product is captured as a structured
 *   per-item error; the remaining dataset always continues.
 * - Bounded concurrency: at most `concurrency` products process at once.
 * - Gemini budget: deterministic evidence produces ZERO Gemini calls;
 *   ambiguous-but-evidenced fields trigger exactly ONE batched call;
 *   duplicate identities are served from cache without any repeat calls.
 * - Cache keys are identity-safe: manufacturer + MPN (+step). Different MPNs
 *   NEVER share cached evidence.
 * - No sample-specific logic of any kind.
 */

import { createHash } from 'crypto';

import type { CanonicalProduct, ProductFieldProvenance } from '@/lib/product-intelligence/types';
import { createEmptyProduct } from '@/lib/product-intelligence/canonical';
import { computeIdentity, type ProductIdentity } from '@/lib/product-intelligence/identity';
import {
  resolveFieldConflict,
  type FieldCandidate,
} from '@/lib/product-intelligence/conflicts';
import { detectMissingFields } from '@/lib/product-intelligence/missing-fields';
import { normalizeCsvInput, fieldValue, fieldNumber, type NormalizedInputRow } from '@/lib/input/input-normalizer';
import { fetchEvidence, type EvidenceServiceResponse } from '@/lib/evidence/client';
import { callLLMWithRetry } from '@/lib/ai/gemini';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineItemError {
  productId: string;
  stage: string;
  message: string;
}

export type ItemOutcomeStatus = 'processed' | 'duplicate' | 'failed' | 'skipped_no_identity';

export interface ProductOutcome {
  id: string;
  rowIndex: number;
  status: ItemOutcomeStatus;
  product: CanonicalProduct | null;
  identity: ProductIdentity;
  duplicateOfId?: string;
  errors: PipelineItemError[];
  rejectReason?: string | null;
}

export interface PipelineMetrics {
  totalProducts: number;
  processed: number;
  failed: number;
  duplicatesMerged: number;
  skippedNoIdentity: number;
  productsWithExternalEvidence: number;
  externalSearches: number;
  externalRetrievals: number;
  deterministicFields: number;
  geminiCalls: number;
  geminiCallsAvoided: number;
  cacheHits: number;
  cacheMisses: number;
  conflicts: number;
  unresolvedFields: number;
  invalidFields: number;
  timing: {
    totalMs: number;
    avgPerProductMs: number;
    externalRetrievalMs: number;
    geminiMs: number;
  };
}

export interface QualityReport extends PipelineMetrics {
  outputColumns: number;
}

/** Injectable Gemini stand-in so tests/batches can count calls w/o network. */
export type GeminiCaller = (
  prompt: string,
) => Promise<{ values: Record<string, unknown> | null; confidence?: number; error?: string | null }>;

export interface EvidenceCache {
  /**
   * Returns the cached response, `null` for a negative-cached entry
   * ("searched, nothing found"), or `undefined` when no entry exists.
   */
  get(key: string): Promise<EvidenceServiceResponse | null | undefined>;
  /** Store a result (null = negative caching of "no evidence found"). */
  set(key: string, value: EvidenceServiceResponse | null): Promise<void>;
}

export interface OrchestratorOptions {
  concurrency?: number;
  evidenceServiceUrl?: string | null;
  gemini?: GeminiCaller | null;
  cache?: EvidenceCache;
  /** Per-product external-evidence timeout. */
  evidenceTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Cache implementations
// ---------------------------------------------------------------------------

/**
 * Identity-safe cache key: manufacturer + MPN + step. Two products share a
 * cache entry ONLY when their normalized identity matches; different MPNs
 * can never collide.
 */
export function evidenceCacheKey(identity: ProductIdentity, step = 'external_evidence'): string {
  const c = identity.components;
  // Prefer strong identity; fall back to whatever components exist.
  const raw = JSON.stringify([c.manufacturerKey, c.brandKey, c.mpnKey, identity.basis]);
  return `${step}:${createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
}

/** In-memory identity-keyed evidence cache (used for batches/tests). */
export class InMemoryEvidenceCache implements EvidenceCache {
  private store = new Map<string, EvidenceServiceResponse | null>();

  async get(key: string): Promise<EvidenceServiceResponse | null | undefined> {
    return this.store.get(key); // undefined = no entry; null = negative entry
  }

  async set(key: string, value: EvidenceServiceResponse | null): Promise<void> {
    this.store.set(key, value);
  }
}

/**
 * Optional persistent cache reusing the EXISTING `enrichment_logs` table
 * (same `_identity_key` convention as app/api/enrich/external-evidence).
 * Only wired when a Supabase admin client is supplied; never required.
 */
export class SupabaseEnrichmentLogsCache implements EvidenceCache {
  constructor(private adminClient: {
    from: (table: string) => any;
  }) {}

  async get(key: string): Promise<EvidenceServiceResponse | null | undefined> {
    const { data } = await this.adminClient
      .from('enrichment_logs')
      .select('output_json')
      .eq('step', 'external_evidence')
      .eq('status', 'success')
      .contains('input_json', { _identity_key: key })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return undefined;
    return (data.output_json as EvidenceServiceResponse | null) ?? null;
  }

  async set(key: string, value: EvidenceServiceResponse | null): Promise<void> {
    await this.adminClient.from('enrichment_logs').insert({
      item_id: `identity:${key.slice(0, 24)}`,
      step: 'external_evidence',
      status: 'success',
      error: null,
      input_json: { _identity_key: key },
      output_json: value,
      duration_ms: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Input row -> seeded CanonicalProduct
// ---------------------------------------------------------------------------

interface SeedSpec {
  inputField: Parameters<typeof fieldValue>[1];
  target: keyof CanonicalProduct;
  numeric?: boolean;
}

const SEED_SPECS: SeedSpec[] = [
  { inputField: 'mfg_part_num', target: 'mfg_part_num' },
  { inputField: 'alternate_part_number', target: 'alternate_part_number' },
  { inputField: 'sku', target: 'sku' },
  { inputField: 'manufacturer_name', target: 'manufacturer_name' },
  { inputField: 'brand_name', target: 'brand_name' },
  { inputField: 'trade_name', target: 'trade_name' },
  { inputField: 'product_name', target: 'product_name' },
  { inputField: 'dept', target: 'dept' },
  { inputField: 'class', target: 'klass' },
  { inputField: 'fine', target: 'fine' },
  { inputField: 'classpath', target: 'classpath' },
  { inputField: 'part_desc', target: 'part_desc' },
  { inputField: 'invoice_desc', target: 'invoice_desc' },
  { inputField: 'mobile_desc', target: 'mobile_desc' },
  { inputField: 'short_desc', target: 'short_desc' },
  { inputField: 'long_desc1', target: 'long_desc1' },
  { inputField: 'retail_desc', target: 'retail_desc' },
  { inputField: 'marketing_description', target: 'marketing_description' },
  { inputField: 'upc', target: 'upc' },
  { inputField: 'ean', target: 'ean' },
  { inputField: 'gtin', target: 'gtin' },
  { inputField: 'unspsc', target: 'unspsc' },
  { inputField: 'list_price', target: 'list_price', numeric: true },
  { inputField: 'length', target: 'length', numeric: true },
  { inputField: 'width', target: 'width', numeric: true },
  { inputField: 'height', target: 'height', numeric: true },
  { inputField: 'weight', target: 'weight', numeric: true },
  { inputField: 'country_of_origin', target: 'country_of_origin' },
  { inputField: 'warranty', target: 'warranty' },
  { inputField: 'selling_qty', target: 'selling_qty', numeric: true },
  { inputField: 'standards_approvals', target: 'standards_approvals' },
  { inputField: 'application', target: 'application' },
  { inputField: 'includes', target: 'includes' },
];

const UOM_TARGETS: Array<{ inputField: string; target: keyof CanonicalProduct }> = [
  { inputField: 'length_uom', target: 'length_uom' },
  { inputField: 'width_uom', target: 'width_uom' },
  { inputField: 'height_uom', target: 'height_uom' },
  { inputField: 'weight_uom', target: 'weight_uom' },
];

function inputProvenance(): ProductFieldProvenance {
  return {
    source_type: 'input',
    source_title: 'organizer-input',
    retrieved_at: new Date(),
  };
}

/**
 * Build the initial CanonicalProduct from a normalized input row.
 * Value-quality rules (Part 6) enforced here:
 *   verified input value -> 'verified'
 *   conflicting input    -> 'conflicting' (value kept, conflict recorded)
 *   invalid format       -> 'invalid' (value nulled, issue recorded)
 *   absent               -> 'unresolved'
 */
export function seedProductFromRow(id: string, row: NormalizedInputRow): CanonicalProduct {
  let product = createEmptyProduct(id);

  for (const spec of SEED_SPECS) {
    const resolved = row.fields[spec.inputField];
    if (!resolved) continue;

    let value: string | number | boolean | null = resolved.value ?? null;
    if (spec.numeric && typeof value === 'string') value = Number(value);
    if (resolved.status === 'invalid') value = null;

    (product as any)[spec.target] = value;

    product.value_status[spec.target as string] =
      resolved.status === 'verified' ? 'verified'
      : resolved.status === 'conflicting' ? 'conflicting'
      : resolved.status === 'invalid' ? 'invalid'
      : 'unresolved';

    if (resolved.status !== 'unresolved') {
      product.field_provenance[spec.target as string] = {
        ...inputProvenance(),
        evidence: resolved.issue ?? undefined,
        confidence: resolved.status === 'verified' ? 0.99 : 0.5,
      };
    }
  }

  // UOM companions
  const uomResolved = (inputField: string) => {
    const f = (row.fields as Record<string, any>)[inputField];
    return f?.value ?? null;
  };
  for (const uom of UOM_TARGETS) {
    const v = uomResolved(uom.inputField) ?? (row.fields as any)[uom.inputField]?.value ?? null;
    if (v != null) {
      (product as any)[uom.target] = String(v);
      product.value_status[uom.target as string] = 'verified';
    } else {
      product.value_status[uom.target as string] = 'unresolved';
    }
  }
  // UoM may also arrive attached to the measurement itself ("2.4 kg").
  for (const [baseField, uomTarget] of [
    ['weight', 'weight_uom'], ['length', 'length_uom'],
    ['width', 'width_uom'], ['height', 'height_uom'],
  ] as const) {
    const resolved = (row.fields as any)[baseField];
    const attached = resolved?.uom ?? null;
    if ((product as any)[uomTarget] == null && attached) {
      (product as any)[uomTarget] = String(attached);
      product.value_status[uomTarget as string] = 'verified';
    }
  }

  // Boolean-ish prop_65
  const p65 = row.fields['prop_65'];
  if (p65?.value != null) {
    const s = String(p65.value).trim().toLowerCase();
    if (['yes', 'true', 'y'].includes(s)) {
      product.prop_65 = true;
      product.value_status['prop_65'] = 'verified';
    } else if (['no', 'false', 'n'].includes(s)) {
      product.prop_65 = false;
      product.value_status['prop_65'] = 'verified';
    } else {
      product.prop_65 = null;
      product.value_status['prop_65'] = 'invalid';
    }
  }

  // Everything not explicitly seeded above stays explicitly 'unresolved'
  // (never silently 'inferred').
  for (const key of Object.keys(product.value_status)) {
    if (product.value_status[key] === 'inferred') {
      product.value_status[key] = (product as any)[key] == null ? 'unresolved' : product.value_status[key];
    }
  }

  return product;
}

// ---------------------------------------------------------------------------
// Evidence application
// ---------------------------------------------------------------------------

/** Map Python-service deterministic field names to canonical targets. */
const SPEC_FIELD_MAP: Record<string, { target: keyof CanonicalProduct; numeric?: boolean }> = {
  upc: { target: 'upc' },
  ean: { target: 'ean' },
  gtin: { target: 'gtin' },
  weight: { target: 'weight', numeric: true },
  length: { target: 'length', numeric: true },
  width: { target: 'width', numeric: true },
  height: { target: 'height', numeric: true },
  warranty: { target: 'warranty' },
};

/** Attribute-producing fields become dynamic attributes with provenance. */
const ATTRIBUTE_FIELDS = new Set(['depth', 'voltage', 'current', 'power', 'rpm', 'pressure', 'temperature', 'pack_quantity']);

function externalCandidate(data: { value: unknown; uom?: string; evidence: string; source_url: string; confidence: number }): FieldCandidate {
  return {
    value: data.value as any,
    authority: 'verified_authoritative',
    source_type: 'external',
    source_url: data.source_url,
    evidence: data.evidence,
    confidence: data.confidence,
  };
}

function inputCandidate(value: unknown): FieldCandidate {
  return { value: value as any, authority: 'verified_input', source_type: 'input' };
}

function applyEvidenceToProduct(
  product: CanonicalProduct,
  evidenceResp: EvidenceServiceResponse,
  metrics: MutableMetrics,
): void {
  for (const [field, data] of Object.entries(evidenceResp.deterministic_fields)) {
    if (data.value == null) continue;

    const mapped = SPEC_FIELD_MAP[field];
    if (mapped) {
      const currentVal = (product as any)[mapped.target];
      const candidates: FieldCandidate[] = [];
      if (currentVal != null && currentVal !== '') candidates.push(inputCandidate(currentVal));
      candidates.push(externalCandidate(data));

      const resolved = resolveFieldConflict(candidates);
      (product as any)[mapped.target] = mapped.numeric ? Number(resolved.value) : resolved.value;
      product.value_status[mapped.target as string] = resolved.status;

      const winner = resolved.candidates[0];
      product.field_provenance[mapped.target as string] = {
        source_type: winner.source_type === 'external' ? 'external' : 'input',
        source_url: winner.source_url,
        evidence: winner.evidence,
        confidence: winner.confidence,
        retrieved_at: new Date(),
      };

      if (mapped.target === 'weight') {
        const uomCands: FieldCandidate[] = [];
        if (product.weight_uom) uomCands.push(inputCandidate(product.weight_uom));
        if (data.uom) uomCands.push(externalCandidate({ ...data, value: data.uom }));
        const uomResolved = resolveFieldConflict(uomCands);
        if (uomResolved.value != null) {
          product.weight_uom = String(uomResolved.value);
          product.value_status['weight_uom'] = uomResolved.status;
        }
      }
      metrics.deterministicFields++;
      if (resolved.conflict) metrics.conflicts++;
      continue;
    }

    if (ATTRIBUTE_FIELDS.has(field)) {
      const exists = product.attributes.some(
        (a) => a.label.toLowerCase() === field.toLowerCase(),
      );
      if (!exists) {
        product.attributes.push({
          label: field,
          value: String(data.value),
          uom: data.uom || undefined,
          confidence: data.confidence,
          provenance: {
            source_type: 'external',
            source_url: data.source_url,
            evidence: data.evidence,
            confidence: data.confidence,
            retrieved_at: new Date(),
          },
          status: 'verified',
        });
        metrics.deterministicFields++;
      }
    }
  }

  if (Object.keys(evidenceResp.deterministic_fields).length > 0) {
    metrics.productsWithExternalEvidence++;
  }
}

async function runGeminiBatch(
  product: CanonicalProduct,
  evidenceResp: EvidenceServiceResponse,
  gemini: GeminiCaller,
  metrics: MutableMetrics,
): Promise<void> {
  const sanitizedEvidence = evidenceResp.evidence
    .map((e) => `${e.field}: ${e.evidence}`)
    .join('; ')
    .slice(0, 2000);

  const prompt =
    'Extract product facts. Use ONLY the evidence below; ' +
    'return null for any field not supported by it. Never invent values.\n\n' +
    `Product: ${product.manufacturer_name ?? ''} ${product.mfg_part_num ?? ''}\n` +
    `Evidence: ${sanitizedEvidence}\n` +
    `Fields to resolve: ${evidenceResp.needs_gemini.join(', ')}\n\n` +
    'Return JSON: { "values": { "<field>": value|null, ... }, "confidence": 0.0-1.0 }';

  metrics.geminiCalls++;
  const t0 = Date.now();
  try {
    const llm = await gemini(prompt);
    metrics.timing.geminiMs += Date.now() - t0;

    if (llm.values) {
      for (const field of evidenceResp.needs_gemini) {
        const v = llm.values[field];
        if (v !== null && v !== undefined && v !== '') {
          const mapped = SPEC_FIELD_MAP[field];
          if (mapped) {
            (product as any)[mapped.target] = mapped.numeric ? Number(v) : v;
            product.value_status[mapped.target as string] = 'inferred';
            product.field_provenance[mapped.target as string] = {
              source_type: 'inferred',
              source_url: evidenceResp.source?.url,
              evidence: sanitizedEvidence.slice(0, 300),
              confidence: typeof llm.confidence === 'number' ? llm.confidence : 0.6,
              retrieved_at: new Date(),
            };
          } else {
            product.attributes.push({
              label: field,
              value: String(v),
              confidence: typeof llm.confidence === 'number' ? llm.confidence : 0.6,
              provenance: {
                source_type: 'inferred',
                source_url: evidenceResp.source?.url,
                confidence: typeof llm.confidence === 'number' ? llm.confidence : 0.6,
                retrieved_at: new Date(),
              },
              status: 'inferred',
            });
          }
        }
      }
    }
  } catch (err) {
    metrics.timing.geminiMs += Date.now() - t0;
    throw err; // handled by per-item isolation upstream
  }
}

// ---------------------------------------------------------------------------
// Metrics container
// ---------------------------------------------------------------------------

interface MutableMetrics extends PipelineMetrics {
  timing: {
    totalMs: number;
    avgPerProductMs: number;
    externalRetrievalMs: number;
    geminiMs: number;
  };
}

function freshMetrics(): MutableMetrics {
  return {
    totalProducts: 0, processed: 0, failed: 0, duplicatesMerged: 0,
    skippedNoIdentity: 0, productsWithExternalEvidence: 0,
    externalSearches: 0, externalRetrievals: 0, deterministicFields: 0,
    geminiCalls: 0, geminiCallsAvoided: 0, cacheHits: 0, cacheMisses: 0,
    conflicts: 0, unresolvedFields: 0, invalidFields: 0,
    timing: { totalMs: 0, avgPerProductMs: 0, externalRetrievalMs: 0, geminiMs: 0 },
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface RunPipelineInput {
  id: string;
  row: NormalizedInputRow;
}

export interface PipelineRunResult {
  outcomes: ProductOutcome[];
  metrics: PipelineMetrics;
  report: QualityReport;
}

/**
 * Run the full pipeline over normalized input rows.
 *
 * @param csvOrRows Either raw CSV text/Buffer or pre-normalized rows.
 */
export async function runPipeline(
  csvOrRows: string | Buffer | NormalizedInputRow[],
  options: OrchestratorOptions = {},
): Promise<PipelineRunResult> {
  const startedAt = Date.now();

  // ---- Input stage -------------------------------------------------------
  let rows: NormalizedInputRow[];
  if (Array.isArray(csvOrRows)) {
    rows = csvOrRows;
  } else {
    const parsed = normalizeCsvInput(csvOrRows);
    rows = parsed.rows;
  }

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 8));
  const evidenceUrl = options.evidenceServiceUrl !== undefined
    ? options.evidenceServiceUrl
    : (process.env.EVIDENCE_SERVICE_URL || null);
  const gemini = options.gemini ?? (async (prompt) => {
    const r = await callLLMWithRetry(prompt, { temperature: 0.1 });
    if (r.error || !r.data) return { values: null, error: r.error };
    const d = r.data as { values?: Record<string, unknown>; confidence?: number };
    return { values: d.values ?? null, confidence: d.confidence };
  });

  const cache = options.cache ?? new InMemoryEvidenceCache();
  const metrics = freshMetrics();

  // ---- Identity + duplicate pre-pass ------------------------------------
  interface WorkItem {
    id: string;
    row: NormalizedInputRow;
    identity: ProductIdentity;
    duplicateOfIndex: number | null;
  }

  const work: WorkItem[] = [];
  const firstIndexByKey = new Map<string, number>();

  rows.forEach((row, idx) => {
    let identity: ProductIdentity;
    try {
      identity = computeIdentity({
        manufacturer: fieldValue(row, 'manufacturer_name'),
        brand: fieldValue(row, 'brand_name'),
        mpn: fieldValue(row, 'mfg_part_num'),
        description: fieldValue(row, 'part_desc'),
      });
    } catch {
      // Even identity computation failing on one poisoned row must not kill
      // the dataset (Part 11): degrade to no-identity and continue.
      identity = {
        key: null, strength: 'none', basis: 'insufficient',
        components: { manufacturerKey: null, brandKey: null, mpnKey: null, descriptionFingerprint: null },
      };
    }

    let duplicateOfIndex: number | null = null;
    if (identity.key && firstIndexByKey.has(identity.key)) {
      duplicateOfIndex = firstIndexByKey.get(identity.key) as number;
    } else if (identity.key) {
      firstIndexByKey.set(identity.key, idx);
    }
    work.push({ id: `row-${row.rowIndex}`, row, identity, duplicateOfIndex });
  });

  metrics.totalProducts = work.length;

  // ---- Per-product processing -------------------------------------------
  const outcomes: ProductOutcome[] = new Array(work.length);

  async function processItem(item: WorkItem, index: number): Promise<void> {
    const errors: PipelineItemError[] = [];
    const nonFatalStages = new Set<string>(['external_evidence', 'gemini_batch']);
    const product = seedProductFromRow(item.id, item.row);

    // Exact-duplicate / same-identity reuse: serve from earlier outcome,
    // avoiding repeated expensive enrichment (Part 4).
    if (item.duplicateOfIndex != null) {
      const primary = outcomes[item.duplicateOfIndex];
      const cloned = primary?.product
        ? ({ ...primary.product, id: item.id, features: [...primary.product.features],
             attributes: [...primary.product.attributes], assets: [...primary.product.assets],
             value_status: { ...primary.product.value_status },
             field_provenance: { ...primary.product.field_provenance } } as CanonicalProduct)
        : product;
      metrics.duplicatesMerged++;
      metrics.cacheHits++;
      outcomes[index] = {
        id: item.id,
        rowIndex: item.row.rowIndex,
        status: 'duplicate',
        product: cloned,
        identity: item.identity,
        duplicateOfId: primary?.id,
        errors: [],
      };
      return;
    }

    if (!item.identity.key) {
      // No reliable identity: process deterministically but never search.
      metrics.skippedNoIdentity++;
    }

    // --- Missing-field analysis ---
    let needed: string[] = [];
    try {
      const missingInfo = detectMissingFields({
        mfg_part_num: product.mfg_part_num,
        manufacturer_name: product.manufacturer_name,
        brand_name: product.brand_name,
        part_desc: product.part_desc,
        dept: product.dept ?? undefined,
        classpath: product.classpath ?? undefined,
        item_specs: {
          upc: product.upc, ean: product.ean, gtin: product.gtin,
          length: product.length, width: product.width,
          height: product.height, weight: product.weight, warranty: product.warranty,
        },
        item_attributes: product.attributes.map((a) => ({ label: a.label, value: a.value })),
      });
      needed = missingInfo.needed;
    } catch (err) {
      errors.push({ productId: item.id, stage: 'missing_field_analysis', message: msg(err) });
    }

    // --- External evidence (only when identity justifies a search) -------
    let evidenceResp: EvidenceServiceResponse | null | undefined;
    if (needed.length > 0 && item.identity.key) {
      const cacheKey = evidenceCacheKey(item.identity);
      evidenceResp = await cache.get(cacheKey);
      if (evidenceResp !== undefined) {
        metrics.cacheHits++;          // includes negative-cached entries
      } else {
        metrics.cacheMisses++;
        const t0 = Date.now();
        try {
          // Only count a real external search when a service is configured;
          // unconfigured/degraded setups perform no searches at all.
          if (evidenceUrl) metrics.externalSearches++;
          evidenceResp = await fetchEvidence(
            {
              manufacturer: product.manufacturer_name ?? '',
              brand: product.brand_name ?? '',
              mpn: product.mfg_part_num ?? '',
              description: product.part_desc ?? '',
              category: product.classpath ?? '',
              missing_fields: needed,
            },
            { serviceUrl: evidenceUrl, timeoutMs: options.evidenceTimeoutMs },
          );
          metrics.timing.externalRetrievalMs += Date.now() - t0;
          await cache.set(cacheKey, evidenceResp ?? null);
        } catch (err) {
          metrics.timing.externalRetrievalMs += Date.now() - t0;
          errors.push({ productId: item.id, stage: 'external_evidence', message: msg(err) });
          evidenceResp = null;
        }
      }

      if (evidenceResp == null) {
        // Service unavailable or nothing found: leave fields unresolved.
      } else if (!evidenceResp.identity_match) {
        // Wrong candidate(s): preserve nothing external, keep unresolved.
      } else {
        metrics.externalRetrievals++;
        try {
          applyEvidenceToProduct(product, evidenceResp, metrics);
        } catch (err) {
          errors.push({ productId: item.id, stage: 'apply_evidence', message: msg(err) });
        }
      }
    }
    // Weak identity: no blind searching — needed fields remain unresolved.

    // --- Gemini: exactly one batched call, only when truly needed --------
    // A Gemini failure degrades to unresolved fields (non-fatal warning):
    // one flaky LLM response must not fail an otherwise-valid product.
    if (evidenceResp && evidenceResp.identity_match &&
        evidenceResp.needs_gemini.length > 0 &&
        (evidenceResp.evidence.length > 0 || Object.keys(evidenceResp.deterministic_fields).length > 0)) {
      try {
        await runGeminiBatch(product, evidenceResp, gemini, metrics);
      } catch (err) {
        errors.push({ productId: item.id, stage: 'gemini_batch', message: msg(err) });
        nonFatalStages.add('gemini_batch');
      }
    } else if (evidenceResp && evidenceResp.identity_match && evidenceResp.needs_gemini.length === 0) {
      metrics.geminiCallsAvoided++;
    }

    // --- Final accounting -------------------------------------------------
    const fatalErrors = errors.filter((e) => !nonFatalStages.has(e.stage));
    let unresolvedCount = 0;
    let invalidCount = 0;
    for (const [, st] of Object.entries(product.value_status)) {
      if (st === 'unresolved') unresolvedCount++;
      if (st === 'invalid') invalidCount++;
    }
    metrics.unresolvedFields += unresolvedCount;
    metrics.invalidFields += invalidCount;

    outcomes[index] = {
      id: item.id,
      rowIndex: item.row.rowIndex,
      status: fatalErrors.length > 0 ? 'failed' : 'processed',
      product,
      identity: item.identity,
      errors,
    };
    if (fatalErrors.length > 0) {
      metrics.failed++;
    } else {
      metrics.processed++;
    }
  }

  // Bounded-concurrency worker pool.
  // Phase 1: unique-identity products (expensive work) with bounded parallelism.
  // Phase 2: duplicates cloned sequentially AFTER their primaries exist,
  // guaranteeing correctness without extra enrichment cost (Part 4).
  let nextIndex = 0;
  void nextIndex; // reserved for future streaming mode
  async function worker(indices: number[]): Promise<void> {
    for (const index of indices) {
      const item = work[index];
      try {
        await processItem(item, index);
      } catch (err) {
        // Absolute last-resort isolation: the dataset must never die.
        // (Fallback seeding is itself guarded — a row corrupted enough to
        // throw twice still yields a structured failed outcome.)
        let fallbackProduct: CanonicalProduct | null = null;
        try {
          fallbackProduct = seedProductFromRow(item.id, item.row);
        } catch {
          fallbackProduct = null;
        }
        outcomes[index] = {
          id: item.id,
          rowIndex: item.row.rowIndex,
          status: 'failed',
          product: fallbackProduct,
          identity: item.identity,
          errors: [{ productId: item.id, stage: 'pipeline', message: msg(err) }],
        };
        metrics.failed++;
      }
    }
  }

  const primaryIndices = work
    .map((w, i) => (w.duplicateOfIndex == null ? i : -1))
    .filter((i) => i >= 0);
  const duplicateIndices = work
    .map((w, i) => (w.duplicateOfIndex != null ? i : -1))
    .filter((i) => i >= 0);

  const lanes: number[][] = Array.from({ length: Math.min(concurrency, Math.max(primaryIndices.length, 1)) }, () => []);
  primaryIndices.forEach((idx, n) => lanes[n % lanes.length].push(idx));
  await Promise.all(lanes.map((lane) => worker(lane)));

  await worker(duplicateIndices);

  // Fill any holes defensively (should be impossible).
  for (let i = 0; i < outcomes.length; i++) {
    if (!outcomes[i]) {
      outcomes[i] = {
        id: work[i].id,
        rowIndex: work[i].row.rowIndex,
        status: 'failed',
        product: null,
        identity: work[i].identity,
        errors: [{ productId: work[i].id, stage: 'pipeline', message: 'outcome not produced' }],
      };
      metrics.failed++;
    }
  }

  metrics.timing.totalMs = Date.now() - startedAt;
  metrics.timing.avgPerProductMs =
    work.length > 0 ? Math.round(metrics.timing.totalMs / work.length) : 0;

  const report: QualityReport = {
    ...metrics,
    outputColumns: 252,
  };

  return { outcomes, metrics, report };
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
