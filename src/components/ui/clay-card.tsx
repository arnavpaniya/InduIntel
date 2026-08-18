'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ClayCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'secondary' | 'sm';
  onClick?: () => void;
}

export function ClayCard({ children, className, variant = 'default', onClick }: ClayCardProps) {
  const baseClasses = 'command-panel transition-colors duration-150';
  const variantClasses = {
    default: 'bg-surface border border-border rounded',
    secondary: 'bg-surface-raised border border-border rounded',
    sm: 'bg-surface border border-border rounded-sm',
  };
  const interactiveClasses = onClick ? 'cursor-pointer hover:border-accent' : '';

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], interactiveClasses, className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }} : undefined}
    >
      {children}
    </div>
  );
}

export function ClaySurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-surface border border-border rounded', className)}>
      {children}
    </div>
  );
}