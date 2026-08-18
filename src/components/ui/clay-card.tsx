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
  const baseClasses = 'transition-all duration-300';
  const variantClasses = {
    default: 'bg-clay rounded-clay-xl shadow-clay',
    secondary: 'bg-clay-secondary rounded-clay-xl shadow-clay',
    sm: 'bg-clay rounded-clay-lg shadow-clay-sm',
  };
  const interactiveClasses = onClick ? 'cursor-pointer hover:shadow-clay-lg active:shadow-clay-inset' : '';

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
    <div className={cn('bg-clay rounded-clay-xl shadow-clay', className)}>
      {children}
    </div>
  );
}