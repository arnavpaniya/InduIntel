/**
 * Conflict Detection + Value-Quality Resolution (Stage 5, Parts 5 + 6)
 *
 * Merges field candidates from multiple tiers of evidence into a single
 * canonical value WITHOUT silently discarding conflicting evidence.
 *
 * Authority priority (highest wins for the display value):
 *   1. verified_authoritative  — identity-matched external source
 *   2. verified_input          — organizer-provided input data
 *   3. inferred                — derived/semantic (e.g., Gemini from evidence)
 *
 * When candidates disagree, status becomes 'conflicting' and ALL candidate
 * values plus provenance are preserved on the result.
 */

import type { ProductFieldStatus } from '@/lib/product-intelligence/types';

export type FieldAuthority = 'verified_authoritative' | 'verified_input' | 'inferred';

export const AUTHORITY_PRIORITY: Record<FieldAuthority, number> = {
  verified_authoritative: 3,
  verified_input: 2,
  inferred: 1,
};

export interface FieldCandidate<T = string | number | boolean> {
  value: T | null;
  authority: FieldAuthority;
  /** Where it came from: 'input' | 'external' | 'inferred' | ... */
  source_type: string;
  source_url?: string;
  evidence?: string;
  confidence?: number;
}

export interface ResolvedField<T = string | number | boolean> {
  value: T | null;
  status: ProductFieldStatus;
  /** All non-null distinct candidates, strongest-authority first. */
  candidates: Array<FieldCandidate<T>>;
  conflict: boolean;
}

/** Canonical comparison form so case/punctuation/whitespace variants merge. */
function comparable(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return String(value).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * True when two candidate values represent the SAME fact.
 * Numeric-aware: 2.40 and "2.4" agree; unit-bearing strings only agree when
 * their full normalized forms match ("2 lb" never merges with "2 kg").
 */
function valuesAgree(a: unknown, b: unknown): boolean {
  const ca = comparable(a);
  const cb = comparable(b);
  if (ca === cb) return true;
  const pureA = /^-?\d+(\.\d+)?$/.test(ca);
  const pureB = /^-?\d+(\.\d+)?$/.test(cb);
  if (pureA && pureB) return Number(ca) === Number(cb);
  return false;
}

/**
 * Resolve one field's candidates into a single canonical outcome.
 *
 * - Null-only candidates resolve to unresolved with no value.
 * - Equal-valued candidates collapse to the highest-authority tier.
 * - Distinct values produce status 'conflicting'; the display value comes
 *   from the highest-priority authority, but every candidate is retained.
 */
export function resolveFieldConflict<T = string | number | boolean>(
  candidates: Array<FieldCandidate<T>>,
): ResolvedField<T> {
  const usable = (candidates || []).filter((c) => c != null && c.value !== null && c.value !== undefined);

  if (usable.length === 0) {
    return { value: null, status: 'unresolved', candidates: [], conflict: false };
  }

  // Sort by authority priority desc (stable for equal priorities).
  const sorted = [...usable].sort(
    (a, b) => AUTHORITY_PRIORITY[b.authority] - AUTHORITY_PRIORITY[a.authority],
  );

  const winner = sorted[0];
  const allAgree = sorted.every((c) => valuesAgree(c.value, winner.value));

  if (allAgree) {
    return { value: winner.value, status: 'verified', candidates: sorted, conflict: false };
  }

  // Conflict: preserve everything; display the most authoritative value.
  return { value: winner.value, status: 'conflicting', candidates: sorted, conflict: true };
}

/**
 * Merge an incoming external-evidence candidate into an existing resolved
 * state (e.g., input-verified value already present). Convenience wrapper.
 */
export function mergeExternalIntoField<T = string | number | boolean>(
  existing: ResolvedField<T> | null,
  incoming: FieldCandidate<T>,
): ResolvedField<T> {
  const baseCandidates = existing?.candidates ?? [];
  return resolveFieldConflict([...baseCandidates, incoming]);
}

/**
 * Value-quality guard: map a raw enrichment outcome to its honest status.
 * Never allows missing -> inferred transitions.
 */
export function statusForOutcome(outcome: {
  hasValue: boolean;
  fromEvidence?: boolean;
  semanticInterpretation?: boolean;
  conflicted?: boolean;
  invalidFormat?: boolean;
}): ProductFieldStatus {
  if (!outcome.hasValue) return 'unresolved';
  if (outcome.invalidFormat) return 'invalid';
  if (outcome.conflicted) return 'conflicting';
  if (outcome.semanticInterpretation) return 'inferred';
  if (outcome.fromEvidence) return 'verified';
  return 'unresolved';
}
