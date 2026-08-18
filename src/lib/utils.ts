import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number | string | null): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return Number.isInteger(num) ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');
}

export function getStatusChip(status: string) {
  const variants: Record<string, string> = {
    VERIFIED: 'status-verified',
    INFERRED: 'status-inferred',
    CONFLICT: 'status-conflict',
    UNKNOWN: 'status-unknown',
  };
  const labels: Record<string, string> = {
    VERIFIED: '✓ VERIFIED',
    INFERRED: '~ INFERRED',
    CONFLICT: '! CONFLICT',
    UNKNOWN: '— UNKNOWN',
  };
  return {
    className: variants[status] || 'status-unknown',
    label: labels[status] || '— UNKNOWN',
  };
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'HIGH': return 'text-status-conflict';
    case 'MEDIUM': return 'text-status-warning';
    case 'LOW': return 'text-text-secondary';
    default: return 'text-text-secondary';
  }
}