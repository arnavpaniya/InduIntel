'use client';

import { cn } from '@/lib/utils';

interface StatusChipProps {
  status: 'VERIFIED' | 'INFERRED' | 'CONFLICT' | 'UNKNOWN';
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export function StatusChip({ status, size = 'md', showIcon = true }: StatusChipProps) {
  const configs = {
    VERIFIED: { className: 'status-verified', icon: '✓', label: 'VERIFIED' },
    INFERRED: { className: 'status-inferred', icon: '~', label: 'INFERRED' },
    CONFLICT: { className: 'status-conflict', icon: '!', label: 'CONFLICT' },
    UNKNOWN: { className: 'status-unknown', icon: '—', label: 'UNKNOWN' },
  };

  const config = configs[status];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span className={cn('status-chip inline-flex items-center gap-1', config.className, sizeClasses)}>
      {showIcon && <span className="font-bold">{config.icon}</span>}
      <span>{config.label}</span>
    </span>
  );
}

export function ConfidenceBar({ confidence, className }: { confidence: number; className?: string }) {
  return (
    <div className={cn('w-full h-2 bg-clay-deep rounded-full overflow-hidden', className)}>
      <div
        className="h-full bg-status-verified rounded-full transition-all duration-500"
        style={{ width: `${Math.max(0, Math.min(100, confidence))}%` }}
      />
    </div>
  );
}

export function CircularProgress({
  value,
  size = 80,
  strokeWidth = 8,
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
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#C7C1B7"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#849783"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-text-primary">{Math.round(value)}%</span>
      </div>
    </div>
  );
}