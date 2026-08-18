'use client';

import { cn } from '@/lib/utils';

interface StatusChipProps {
  status: 'VERIFIED' | 'INFERRED' | 'CONFLICT' | 'UNKNOWN';
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function StatusChip({ status, size = 'md', showIcon = true }: StatusChipProps) {
  const configs = {
    VERIFIED: { className: 'status-verified', icon: '●', label: 'VERIFIED' },
    INFERRED: { className: 'status-inferred', icon: '◐', label: 'INFERRED' },
    CONFLICT: { className: 'status-conflict', icon: '▲', label: 'CONFLICT' },
    UNKNOWN: { className: 'status-unknown', icon: '○', label: 'UNKNOWN' },
  };

  const config = configs[status] || configs.UNKNOWN;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={cn('status-chip font-mono inline-flex items-center gap-1.5 rounded border uppercase font-medium', config.className, sizeClasses)}>
      {showIcon && <span>{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
}

export function ConfidenceBar({ confidence, className }: { confidence: number; className?: string }) {
  return (
    <div className={cn('w-full h-2 bg-surface-raised border border-border rounded overflow-hidden', className)}>
      <div
        className="h-full bg-status-verified transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }}
      />
    </div>
  );
}

export function CircularProgress({
  value,
  size = 80,
  strokeWidth = 6,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center font-mono', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#262B33"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#4CAF7D"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-text-primary">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

export function WhyButton({ attribute, onClick }: { attribute: any; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-accent hover:underline font-mono text-xs font-medium cursor-pointer transition-colors"
      title="View evidence & provenance"
    >
      Why?
    </button>
  );
}