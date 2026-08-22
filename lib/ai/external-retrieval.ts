export interface GeminiUsageReport {
  productsTested: number; externalSearches: number; externalRetrievals: number;
  deterministicExtractions: number; geminiCalls: number; geminiCallsAvoided: number;
  cacheHits: number; cacheMisses: number;
}
export const geminiUsageTracker = {
  productsTested: 0, externalSearches: 0, externalRetrievals: 0,
  deterministicExtractions: 0, geminiCalls: 0, geminiCallsAvoided: 0,
  cacheHits: 0, cacheMisses: 0,
  recordProductTested(): void { this.productsTested++; },
  recordExternalSearch(): void { this.externalSearches++; },
  recordExternalRetrieval(): void { this.externalRetrievals++; },
  recordDeterministicExtraction(): void { this.deterministicExtractions++; },
  recordGeminiCall(): void { this.geminiCalls++; },
  recordGeminiCallAvoided(): void { this.geminiCallsAvoided++; },
  recordCacheHit(): void { this.cacheHits++; },
  recordCacheMiss(): void { this.cacheMisses++; },
  getReport(): GeminiUsageReport {
    return { productsTested: this.productsTested, externalSearches: this.externalSearches,
      externalRetrievals: this.externalRetrievals, deterministicExtractions: this.deterministicExtractions,
      geminiCalls: this.geminiCalls, geminiCallsAvoided: this.geminiCallsAvoided,
      cacheHits: this.cacheHits, cacheMisses: this.cacheMisses };
  },
}
export interface DeterministicExtraction {
  upc?: string; ean?: string; gtin?: string; 
  weight?: { value: number; uom: string } | undefined; 
  warranty?: string | undefined; 
  dimensions?: { value: number; uom: string }[] | undefined; 
  mpn?: string | undefined; title?: string | undefined; manufacturer?: string | undefined;
}
export interface RetrievalResult {
  success: boolean; evidenceText: string; rawUrl: string; finalUrl: string;
  status: number; evidence: Record<string, string>; error?: string;
}
export function isDeterministicSufficient(
  extracted: DeterministicExtraction,
  missingFields: string[]
): boolean {
  const c = missingFields.filter(f => ['upc','ean','gtin','weight','warranty'].includes(f));
  return c.every(f => extracted[f] != null);
}
