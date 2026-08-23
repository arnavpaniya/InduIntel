/**
 * Evidence Service Client (Stage 5, Part 8)
 *
 * Thin, reusable client for the completed Stage 4 Python evidence service.
 * This is NOT another retrieval system — all discovery/retrieval/sanitization/
 * identity-verification/extraction logic lives in services/evidence.
 *
 * Guarantees:
 * - Unavailable service / timeout returns null (caller degrades gracefully).
 * - Bounded timeout; no retries here (the Python service owns retrieval
 *   retry policy and candidate iteration).
 */

export interface EvidenceServiceRequest {
  manufacturer: string;
  brand: string;
  mpn: string;
  description: string;
  category: string;
  missing_fields: string[];
}

export interface EvidenceItem {
  field: string;
  value: unknown;
  uom?: string;
  evidence: string;
  source_url: string;
  confidence: number;
}

export interface EvidenceSourceInfo {
  url: string;
  title: string;
  domain: string;
  source_type: string;
  authority_tier: number;
  retrieved_at: string;
}

export interface EvidenceServiceResponse {
  success: boolean;
  needs_search: boolean;
  source: EvidenceSourceInfo | null;
  identity_match: boolean;
  identity_confidence: number;
  reject_reason: string | null;
  evidence: EvidenceItem[];
  deterministic_fields: Record<string, {
    value: unknown; uom?: string; evidence: string;
    source_url: string; confidence: number;
  }>;
  needs_gemini: string[];
  unresolved: string[];
}

export interface FetchEvidenceOptions {
  serviceUrl?: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Call the Python evidence service. Returns null when the service is not
 * configured, unreachable, times out, or answers non-2xx — never throws.
 */
export async function fetchEvidence(
  request: EvidenceServiceRequest,
  options: FetchEvidenceOptions = {},
): Promise<EvidenceServiceResponse | null> {
  const serviceUrl = options.serviceUrl ?? process.env.EVIDENCE_SERVICE_URL ?? '';
  if (!serviceUrl) return null;

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const dbg = process.env.DEBUG_EVIDENCE;
  try {
    if (dbg) {
      // eslint-disable-next-line no-console
      console.error(`[EVIDENCE_CLIENT] -> ${mpnOf(request)} url=${serviceUrl}`);
    }
    const resp = await doFetch(`${serviceUrl.replace(/\/$/, '')}/evidence/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!resp.ok) {
      if (dbg) {
        const bodyText = await resp.text().catch(() => '');
        // eslint-disable-next-line no-console
        console.error(`[EVIDENCE_CLIENT] HTTP ${resp.status}: ${bodyText.slice(0, 300)}`);
      }
      return null;
    }
    const parsed = (await resp.json()) as EvidenceServiceResponse;
    if (dbg) {
      // eslint-disable-next-line no-console
      console.error(`[EVIDENCE_CLIENT] <- ${mpnOf(request)} match=${parsed.identity_match} reject=${parsed.reject_reason}`);
    }
    return parsed;
  } catch (err) {
    if (dbg) {
      // eslint-disable-next-line no-console
      console.error(`[EVIDENCE_CLIENT] ERR ${mpnOf(request)}: ${err instanceof Error ? err.message : String(err)}`);
    }
    // Unreachable / aborted / invalid JSON — degrade, don't crash.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function mpnOf(request: EvidenceServiceRequest): string {
  return request.mpn || '(no-mpn)';
}
