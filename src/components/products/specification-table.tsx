'use client';

import { ProductAttribute } from '@/types';
import { cn, formatNumber, getStatusChip } from '@/lib/utils';
import { StatusChip, WhyButton } from '@/components/ui/status-chip';
import { EvidenceDrawer } from '@/components/evidence/evidence-drawer';
import { useState } from 'react';
import { Hash, ChevronDown, ChevronUp } from 'lucide-react';

interface SpecificationTableProps {
  attributes: ProductAttribute[];
  onWhyClick?: (attribute: ProductAttribute) => void;
}

export function SpecificationTable({ attributes, onWhyClick }: SpecificationTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedAttribute, setSelectedAttribute] = useState<ProductAttribute | null>(null);

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleWhyClick = (attr: ProductAttribute) => {
    setSelectedAttribute(attr);
    onWhyClick?.(attr);
  };

  const requiredAttrs = attributes.filter(a => a.key !== 'dimensions' && a.key !== 'weight' && a.key !== 'material' && a.key !== 'application' && a.key !== 'standards' && a.key !== 'certification' && a.key !== 'lubrication' && a.key !== 'temperature_range' && a.key !== 'clearance' && a.key !== 'standard' && a.key !== 'inlet_size' && a.key !== 'outlet_size' && a.key !== 'pressure' && a.key !== 'seal_type');
  const optionalAttrs = attributes.filter(a => !requiredAttrs.includes(a));

  return (
    <div className="clay-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead>
            <tr className="border-b border-clay-deep/30">
              <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Specification</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Value</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-text-secondary uppercase tracking-wider w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clay-deep/30">
            {requiredAttrs.map((attr, index) => (
              <SpecificationRow
                key={attr.key}
                attribute={attr}
                index={index}
                isExpanded={expandedRows.has(attr.key)}
                onToggle={() => toggleRow(attr.key)}
                onWhyClick={handleWhyClick}
              />
            ))}
            {optionalAttrs.length > 0 && (
              <>
                <tr>
                  <td colSpan={4} className="px-6 py-3">
                    <div className="flex items-center gap-3 text-xs font-medium text-text-secondary uppercase tracking-wider">
                      <div className="flex-1 h-px bg-clay-deep" />
                      <span>Optional Attributes</span>
                      <div className="flex-1 h-px bg-clay-deep" />
                    </div>
                  </td>
                </tr>
                {optionalAttrs.map((attr, index) => (
                  <SpecificationRow
                    key={attr.key}
                    attribute={attr}
                    index={requiredAttrs.length + index}
                    isExpanded={expandedRows.has(attr.key)}
                    onToggle={() => toggleRow(attr.key)}
                    onWhyClick={handleWhyClick}
                  />
                ))}
              </>
            )}
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

function SpecificationRow({
  attribute,
  index,
  isExpanded,
  onToggle,
  onWhyClick,
}: {
  attribute: ProductAttribute;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onWhyClick: (attr: ProductAttribute) => void;
}) {
  const statusConfig = getStatusChip(attribute.status);
  const hasEvidence = attribute.evidence.length > 0;
  const hasConflict = attribute.status === 'CONFLICT';

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className={cn('hover:bg-clay-secondary/50 transition-colors', hasConflict && 'bg-status-conflict/5')}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-medium text-text-primary truncate">{attribute.label}</span>
            {attribute.key !== 'manufacturer' && attribute.key !== 'model' && (
              <WhyButton attribute={attribute} onClick={() => onWhyClick(attribute)} />
            )}
          </div>
          {isExpanded && attribute.evidence.length > 0 && (
            <div className="mt-2 ml-8 text-xs text-text-secondary border-l border-clay-deep pl-2 space-y-1">
              {attribute.evidence.slice(0, 2).map((e, i) => (
                <div key={i} className="truncate">"{e.quote}" — {e.documentName}, p.{e.page}</div>
              ))}
              {attribute.evidence.length > 2 && (
                <div className="text-status-warning">+{attribute.evidence.length - 2} more sources</div>
              )}
            </div>
          )}
        </td>
        <td className="px-6 py-4 font-mono text-text-primary">
          {attribute.value !== null ? `${formatNumber(attribute.value)} ${attribute.unit || ''}`.trim() : '—'}
        </td>
        <td className="px-6 py-4">
          <StatusChip status={attribute.status} size="sm" />
        </td>
        <td className="px-6 py-4 text-right">
          {(hasEvidence || attribute.status === 'CONFLICT' || attribute.status === 'INFERRED') && (
            <button
              onClick={onToggle}
              className="p-1.5 rounded hover:bg-clay-deep transition-colors text-text-secondary"
              aria-label={isExpanded ? 'Collapse evidence' : 'Expand evidence'}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
        </td>
      </motion.tr>
      {isExpanded && hasEvidence && (
        <tr className="bg-clay/30">
          <td colSpan={4} className="px-6 pb-4">
            <div className="ml-8 space-y-2">
              {attribute.evidence.map((evidence, eIndex) => (
                <div
                  key={`${evidence.documentId}-${evidence.page}-${eIndex}`}
                  className="clay-surface-sm p-3 text-sm"
                >
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <span className="font-medium text-text-primary">{evidence.documentName}</span>
                    <span className="px-2 py-0.5 bg-clay-deep rounded text-xs">Page {evidence.page}</span>
                  </div>
                  <blockquote className="text-text-secondary border-l-2 border-clay-deep pl-3 italic">
                    "{evidence.quote}"
                  </blockquote>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}