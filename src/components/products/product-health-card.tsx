'use client';

import { Product } from '@/types';
import { CircularProgress } from '@/components/ui/status-chip';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, MinusCircle, HelpCircle } from 'lucide-react';

interface ProductHealthCardProps {
  product: Product;
  className?: string;
}

export function ProductHealthCard({ product, className }: ProductHealthCardProps) {
  const verifiedCount = product.attributes.filter(a => a.status === 'VERIFIED').length;
  const inferredCount = product.attributes.filter(a => a.status === 'INFERRED').length;
  const conflictCount = product.attributes.filter(a => a.status === 'CONFLICT').length;
  const unknownCount = product.attributes.filter(a => a.status === 'UNKNOWN').length;
  const missingCount = product.missingAttributes.length;

  const totalAttrs = product.attributes.length;
  const completeness = totalAttrs > 0 ? Math.round(((verifiedCount + inferredCount) / totalAttrs) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn('clay-surface p-6 md:p-8', className)}
    >
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">PRODUCT HEALTH</h3>
          <div className="text-sm text-text-secondary">
            {product.manufacturer} {product.model} · {product.category.replace('_', ' ')}
          </div>
        </div>
        <div className="flex-shrink-0">
          <CircularProgress value={completeness} size={100} strokeWidth={10} />
        </div>
      </div>

      <div className="relative h-3 bg-clay-deep rounded-full overflow-hidden mb-6">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${completeness}%` }}
          transition={{ duration: 800, ease: 'easeOut' }}
          className="h-full bg-status-verified rounded-full"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatItem
          icon={CheckCircle}
          color="text-status-verified"
          label="Verified"
          value={verifiedCount}
        />
        <StatItem
          icon={HelpCircle}
          color="text-status-warning"
          label="Inferred"
          value={inferredCount}
        />
        <StatItem
          icon={AlertTriangle}
          color="text-status-conflict"
          label="Conflicts"
          value={conflictCount}
        />
        <StatItem
          icon={MinusCircle}
          color="text-text-secondary"
          label="Missing"
          value={missingCount}
        />
      </div>

      <div className="mt-6 pt-6 border-t border-clay-deep/30">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span className="font-medium text-text-primary">{completeness}% Complete</span>
          <span className="px-2 py-0.5 bg-clay-deep rounded text-xs">{product.confidence}% Confidence</span>
          {product.conflicts.length > 0 && (
            <span className="px-2 py-0.5 bg-status-conflict/20 text-status-conflict rounded text-xs">
              {product.conflicts.length} Conflict{product.conflicts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatItem({ icon: Icon, color, label, value }: { icon: React.ComponentType<{ className?: string }>; color: string; label: string; value: number }) {
  return (
    <div className="flex flex-col items-center text-center p-3 clay-surface-sm rounded-clay">
      <Icon className={cn('w-6 h-6 mb-2', color)} />
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-secondary">{label}</div>
    </div>
  );
}

export function CompletenessBreakdown({ product }: { product: Product }) {
  const categories = [
    { key: 'VERIFIED', label: 'Verified', color: 'text-status-verified', count: product.attributes.filter(a => a.status === 'VERIFIED').length },
    { key: 'INFERRED', label: 'Inferred', color: 'text-status-warning', count: product.attributes.filter(a => a.status === 'INFERRED').length },
    { key: 'CONFLICT', label: 'Conflicts', color: 'text-status-conflict', count: product.attributes.filter(a => a.status === 'CONFLICT').length },
    { key: 'UNKNOWN', label: 'Unknown', color: 'text-text-secondary', count: product.attributes.filter(a => a.status === 'UNKNOWN').length },
  ];

  return (
    <div className="clay-surface p-6">
      <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">ATTRIBUTE BREAKDOWN</h3>
      <div className="space-y-3">
        {categories.map((cat) => (
          <motion.div
            key={cat.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-4"
          >
            <div className="w-24 text-xs font-medium text-text-secondary">{cat.label}</div>
            <div className="flex-1 h-2 bg-clay-deep rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${product.attributes.length > 0 ? (cat.count / product.attributes.length) * 100 : 0}%` }}
                transition={{ duration: 600, delay: 0.2 }}
                className="h-full rounded-full"
                style={{ backgroundColor: cat.color.replace('text-', '') }}
              />
            </div>
            <div className="w-12 text-right font-mono text-text-primary">{cat.count}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}