/**
 * Single source of truth for enrichment lifecycle semantics shared by the
 * dashboard, the product report page, the PDF report, and tests.
 *
 * Framework-free on purpose: no React, no Supabase, no env access.
 * Every user-facing string here must be safe to render — no provider
 * responses, stack traces, URLs, or credentials ever flow through this module.
 */

export type LifecycleStatus = 'raw' | 'enriching' | 'enriched' | 'review' | 'failed';

export const LIFECYCLE_STATUSES: LifecycleStatus[] = ['raw', 'enriching', 'enriched', 'review', 'failed'];

/** Explicit badge/status label per lifecycle state. Never infer another state. */
export const STATUS_LABELS: Record<LifecycleStatus, string> = {
  raw: 'Not Cleaned Yet',
  enriching: 'AI Cleaning In Progress…',
  enriched: 'Enriched',
  review: 'Needs Quick Check',
  failed: 'Cleaning Failed',
};

/** Human-readable pipeline step names (keys match backend step identifiers). */
export const STEP_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  classify: 'Classification',
  'missing-field-analysis': 'Missing-field analysis',
  external_evidence: 'External evidence',
  attributes: 'Attribute extraction',
  descriptions: 'Description generation',
  specs: 'Specifications',
};

/** Fallback-safe humanizer for unexpected step identifiers. */
export function stepLabel(step?: string | null): string {
  if (!step) return 'Unknown step';
  return STEP_LABELS[step] ?? step.replace(/_/g, ' ');
}

export interface ReportIntroOptions {
  failedStep?: string | null;
  /** true when earlier steps saved data before the failure */
  hasPartialData?: boolean;
}

/**
 * Truthful introductory sentence(s) for the product report, per lifecycle
 * state. Unknown statuses degrade to the honest "not cleaned yet" wording.
 * Only whitelisted inputs influence the output — extra fields are ignored.
 */
export function reportIntroCopy(status: string, opts: ReportIntroOptions = {}): string {
  switch (status) {
    case 'enriching':
      return 'AI cleaning is currently in progress.';
    case 'enriched':
      return 'This product was successfully enriched by the AI pipeline.';
    case 'review':
      return 'This product was enriched but requires a human review.';
    case 'failed': {
      const base = `AI cleaning failed during ${stepLabel(opts.failedStep)}. No further enrichment steps were completed after the failure.`;
      return opts.hasPartialData ? `${base} Some earlier enrichment data was saved before the failure.` : base;
    }
    case 'raw':
    default:
      // Unknown status must never be presented as enrichment progress/success.
      return 'This product has not been cleaned yet.';
  }
}

export interface ReportBannerConfig {
  bg: string;
  border: string;
  title: string;
  text: string;
}

/**
 * Per-status banner configuration for the PDF report. Colors mirror the
 * existing report palette. The failed banner surfaces ONLY the backend's
 * safe failed_error — callers pass it through verbatim or omit it.
 */
export function reportBanner(
  status: string,
  opts: { failedStep?: string | null; failedError?: string | null } = {},
): ReportBannerConfig {
  switch (status) {
    case 'enriching':
      return {
        bg: '#e0f2fe', border: '#7dd3fc', title: 'Currently cleaning',
        text: 'An enrichment job is in progress. This snapshot may be incomplete.',
      };
    case 'failed':
      return {
        bg: '#fee2e2', border: '#fca5a5',
        title: `Cleaning failed${opts.failedStep ? ` at ${stepLabel(opts.failedStep)}` : ''}`,
        text: opts.failedError || 'The last enrichment run did not complete. Values below are limited to what was saved before the failure.',
      };
    case 'review':
      return {
        bg: '#fef3c7', border: '#fcd34d', title: 'Partial enrichment — review required',
        text: 'Some details were unclear or missing. A quick human check is recommended before publishing.',
      };
    case 'enriched':
      return {
        bg: '#dcfce7', border: '#86efac', title: 'Enrichment completed successfully',
        text: 'All pipeline steps saved their results for this product.',
      };
    case 'raw':
    default:
      return {
        bg: '#f1f5f9', border: '#cbd5e1', title: 'Not cleaned yet',
        text: 'This product has not been through the enrichment pipeline yet. Sections below show only the original supplier data.',
      };
  }
}

/** Sum of the known lifecycle buckets (used to detect unmapped statuses). */
export function sumKnownStatusCounts(counts: Record<string, number>): number {
  return LIFECYCLE_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
}

/**
 * > 0 means the database holds statuses outside the five known lifecycle
 * buckets — the UI must surface that remainder instead of silently hiding it.
 */
export function unknownStatusCount(total: number, counts: Record<string, number>): number {
  return Math.max(0, total - sumKnownStatusCounts(counts));
}
