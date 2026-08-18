'use client';

import { Product } from '@/types';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface ProductHealthCardProps {
  product: Product;
  className?: string;
}

export function ProductHealthCard({ product, className }: ProductHealthCardProps) {
  const attributes = product.attributes || [];
  const missingAttributes = product.missingAttributes || [];

  const verifiedCount = attributes.filter(a => a?.status === 'VERIFIED').length;
  const inferredCount = attributes.filter(a => a?.status === 'INFERRED').length;
  const conflictCount = attributes.filter(a => a?.status === 'CONFLICT').length;
  const missingCount = missingAttributes.length;

  const totalAttrs = attributes.length;
  const completeness = product.completeness || (totalAttrs > 0 ? Math.round(((verifiedCount + inferredCount) / totalAttrs) * 100) : 0);

  return (
    <Link href={`/products/${product.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className={cn('command-panel p-6 hover:border-accent transition-colors group cursor-pointer space-y-4', className)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-divider pb-3">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
              {product.category.replace('_', ' ')}
            </div>
            <h3 className="text-base font-sans font-medium text-text-primary group-hover:text-accent transition-colors mt-0.5">
              {product.name || `${product.manufacturer} ${product.model}`}
            </h3>
          </div>
          <div className="text-right font-mono">
            <span className="text-2xl font-medium text-status-verified">{completeness}%</span>
          </div>
        </div>

        {/* Progress Bar (Section 10) */}
        <div className="w-full h-2 bg-surface-raised border border-border rounded overflow-hidden">
          <div
            className="h-full bg-status-verified transition-all duration-300"
            style={{ width: `${completeness}%` }}
          />
        </div>

        {/* Counts row: monospace numbers, colored dot before each label matching status color */}
        <div className="flex items-center justify-between text-xs font-mono pt-1 text-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="text-status-verified">●</span>
            <span>{verifiedCount} VERIFIED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-status-inferred">◐</span>
            <span>{inferredCount} INFERRED</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-status-conflict">▲</span>
            <span className={conflictCount > 0 ? 'text-status-conflict font-medium' : ''}>{conflictCount} CONFLICT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">○</span>
            <span>{missingCount} MISSING</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}