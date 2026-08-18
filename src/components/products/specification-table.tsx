'use client';

import { ProductAttribute } from '@/types';
import { formatNumber } from '@/lib/utils';
import { StatusChip, WhyButton } from '@/components/ui/status-chip';
import { EvidenceDrawer } from '@/components/evidence/evidence-drawer';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface SpecificationTableProps {
  attributes: ProductAttribute[];
  onWhyClick?: (attribute: ProductAttribute) => void;
}

export function SpecificationTable({ attributes, onWhyClick }: SpecificationTableProps) {
  const [selectedAttribute, setSelectedAttribute] = useState<ProductAttribute | null>(null);

  const handleWhyClick = (attr: ProductAttribute) => {
    setSelectedAttribute(attr);
    onWhyClick?.(attr);
  };

  return (
    <div className="command-panel overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left" role="table">
          <thead>
            <tr className="border-b border-border text-[11px] font-mono text-text-secondary uppercase tracking-wider bg-background/50">
              <th className="px-6 py-3 font-medium">KEY</th>
              <th className="px-6 py-3 font-medium">VALUE</th>
              <th className="px-6 py-3 font-medium">STATUS</th>
              <th className="px-6 py-3 font-medium text-right">EVIDENCE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {attributes.map((attr, index) => {
              const hasConflict = attr.status === 'CONFLICT';
              const isUnknown = attr.status === 'UNKNOWN';

              return (
                <motion.tr
                  key={attr.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1, delay: index * 0.01 }}
                  className={`hover:bg-surface-hover transition-colors ${hasConflict ? 'border-l-2 border-l-status-conflict bg-status-conflict/5' : ''}`}
                >
                  <td className="px-6 py-3.5 text-xs font-mono font-medium text-text-secondary uppercase">
                    {attr.label || attr.key}
                  </td>
                  <td className="px-6 py-3.5 text-sm font-mono text-text-primary">
                    {attr.value !== null ? `${formatNumber(attr.value)} ${attr.unit || ''}`.trim() : '—'}
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusChip status={attr.status} size="sm" />
                  </td>
                  <td className="px-6 py-3.5 text-right font-mono">
                    {!isUnknown ? (
                      <WhyButton attribute={attr} onClick={() => handleWhyClick(attr)} />
                    ) : (
                      <span className="text-xs text-text-muted">—</span>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EvidenceDrawer
        isOpen={!!selectedAttribute}
        onClose={() => setSelectedAttribute(null)}
        attribute={selectedAttribute}
        allAttributes={attributes}
      />
    </div>
  );
}