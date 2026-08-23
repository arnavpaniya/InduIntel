/**
 * Product Identity (Stage 5, Part 3)
 *
 * Robust, deterministic product identity keys for duplicate detection and
 * evidence cache safety.
 *
 * Identity priority:
 *   1. manufacturer + MPN          (strong)
 *   2. manufacturer + brand + strong description (medium)
 *   3. brand + strong description  (medium)
 *   - description ALONE is never a reliable identity (strength 'none').
 *
 * Normalization: Unicode NFKC, case folding, whitespace collapse and
 * separator folding for COMPARISON KEYS only. Meaningful MPN characters
 * (letters/digits) are never destroyed: "ABC-123" keeps all alphanumerics,
 * so it can never become an unrelated identifier.
 */

export type IdentityStrength = 'strong' | 'medium' | 'weak' | 'none';
export type IdentityBasis =
  | 'manufacturer_mpn'
  | 'manufacturer_brand_description'
  | 'brand_description'
  | 'insufficient';

export interface ProductIdentityInput {
  manufacturer?: string | null;
  brand?: string | null;
  mpn?: string | null;
  description?: string | null;
}

export interface ProductIdentity {
  /** Stable dedupe/cache key. null when identity is insufficient. */
  key: string | null;
  strength: IdentityStrength;
  basis: IdentityBasis;
  /** Normalized components used in the key (for diagnostics). */
  components: {
    manufacturerKey: string | null;
    brandKey: string | null;
    mpnKey: string | null;
    descriptionFingerprint: string | null;
  };
}

/** Collapse Unicode variants and case for comparison. */
export function normalizeTextForIdentity(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value)
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\uFEFF]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return s === '' ? null : s;
}

/**
 * MPN comparison key. Uppercase; separator characters (space, hyphen,
 * underscore, slash, dot) are folded away because vendors write the same MPN
 * as "ABC-123", "ABC 123" or "ABC123". All letters/digits are preserved, so
 * an MPN can never fold into an unrelated identifier.
 */
export function mpnKey(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).normalize('NFKC').toUpperCase();
  const folded = s.replace(/[\s\-_/.\\]/g, '');
  return folded === '' ? null : folded;
}

/** Company-name suffix noise stripped for name comparison. */
const NAME_SUFFIXES = /\b(inc|incorporated|llc|ltd|limited|gmbh|co|corp|corporation|company|s\.a\.|ag|bv|plc|kg|ug)\b/g;

/** Normalize a manufacturer/brand name for comparison. */
export function nameKey(value: string | null | undefined): string | null {
  const base = normalizeTextForIdentity(value);
  if (!base) return null;
  return base.replace(/[,.\-()]/g, ' ').replace(NAME_SUFFIXES, '').replace(/\s+/g, ' ').trim() || base;
}

/** A description is "strong" when specific enough to support identity. */
export function isStrongDescription(description: string | null | undefined): boolean {
  if (description == null) return false;
  const s = normalizeTextForIdentity(description);
  if (!s) return false;
  if (s.length < 20) return false;
  // Must contain at least some informational tokens (not just filler words)
  const tokens = s.split(' ').filter((t) => t.length > 1);
  return tokens.length >= 4;
}

/** Short stable fingerprint of a description (for medium-identity keys). */
function descriptionFingerprint(description: string): string {
  const s = normalizeTextForIdentity(description) as string;
  // First 12 significant tokens, alphabetically sorted for order-insensitivity
  const tokens = s
    .split(' ')
    .map((t) => t.replace(/[^a-z0-9\u00c0-\uffff]/g, ''))
    .filter((t) => t.length > 1)
    .sort()
    .slice(0, 12);
  return tokens.join('|');
}

/**
 * Compute the product identity for the given identity fields following the
 * documented priority ladder. Never merges products that merely have similar
 * descriptions: description-only inputs yield strength 'none' and key null.
 */
export function computeIdentity(input: ProductIdentityInput): ProductIdentity {
  const mfrKey = nameKey(input.manufacturer ?? null);
  const bKey = nameKey(input.brand ?? null);
  const pKey = mpnKey(input.mpn ?? null);
  const strongDesc = isStrongDescription(input.description);
  const fp = strongDesc && input.description
    ? descriptionFingerprint(input.description)
    : null;

  const components = {
    manufacturerKey: mfrKey,
    brandKey: bKey,
    mpnKey: pKey,
    descriptionFingerprint: fp,
  };

  // 1. manufacturer + MPN — strongest
  if (mfrKey && pKey) {
    return { key: `m:${mfrKey}|p:${pKey}`, strength: 'strong', basis: 'manufacturer_mpn', components };
  }

  // 2. manufacturer + brand + strong description
  if (mfrKey && bKey && fp) {
    return {
      key: `m:${mfrKey}|b:${bKey}|d:${fp}`,
      strength: 'medium',
      basis: 'manufacturer_brand_description',
      components,
    };
  }

  // 3. brand + strong description
  if (bKey && fp) {
    return { key: `b:${bKey}|d:${fp}`, strength: 'medium', basis: 'brand_description', components };
  }

  // Insufficient identity — never merge on weak signals (e.g. description alone).
  return { key: null, strength: 'none', basis: 'insufficient', components };
}
