'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Hash, AlertTriangle, CheckCircle, AlertCircle, MinusCircle } from 'lucide-react';
import { Evidence, ProductAttribute } from '@/types';
import { cn, getStatusChip } from '@/lib/utils';
import { StatusChip } from '@/components/ui/status-chip';

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  attribute: ProductAttribute | null;
  allAttributes?: ProductAttribute[];
}

export function EvidenceDrawer({ isOpen, onClose, attribute, allAttributes = [] }: EvidenceDrawerProps) {
  if (!attribute) return null;

  const conflictAttrs = allAttributes.filter(a => a.key === attribute.key && a.status === 'CONFLICT');
  const hasConflicts = conflictAttrs.length > 0 || attribute.status === 'CONFLICT';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="evidence-drawer"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="evidence-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="evidence-panel max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-clay-deep/30 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 id="evidence-title" className="text-xl font-bold text-text-primary mb-1">
                  {attribute.label}
                </h2>
                <div className="flex items-center gap-3 text-text-secondary text-sm">
                  <span className="font-mono text-text-primary">{attribute.value !== null ? `${attribute.value} ${attribute.unit || ''}`.trim() : '—'}</span>
                  <StatusChip status={attribute.status} size="sm" />
                </div>
                <div className="mt-2 text-sm text-text-secondary">
                  Confidence: <span className="font-medium text-text-primary">{Math.round(attribute.confidence * 100)}%</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-clay-deep transition-colors text-text-secondary"
                aria-label="Close evidence drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {attribute.evidence.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Evidence</h3>
                  <div className="space-y-4">
                    {attribute.evidence.map((evidence, index) => (
                      <motion.div
                        key={`${evidence.documentId}-${evidence.page}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="clay-surface-sm p-4"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="w-4 h-4 text-text-secondary" />
                          <span className="font-medium text-text-primary truncate">{evidence.documentName}</span>
                          <span className="px-2 py-0.5 bg-clay-deep rounded text-xs text-text-secondary">
                            Page {evidence.page}
                          </span>
                        </div>
                        <blockquote className="text-text-secondary border-l-2 border-status-verified pl-4 italic">
                          "{evidence.quote}"
                        </blockquote>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {hasConflicts && (
                <section>
                  <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-status-conflict" />
                    Conflicting Sources
                  </h3>
                  <div className="space-y-4">
                    {conflictAttrs.map((conflictAttr, index) => (
                      <motion.div
                        key={`conflict-${conflictAttr.key}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="clay-surface-sm p-4 border-l-4 border-status-conflict"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <AlertCircle className="w-4 h-4 text-status-conflict" />
                          <span className="font-medium text-text-primary">{conflictAttr.label}</span>
                          <StatusChip status="CONFLICT" size="sm" />
                        </div>
                        <div className="ml-7 space-y-2">
                          {conflictAttr.evidence.map((evidence, eIndex) => (
                            <div key={`${evidence.documentId}-${evidence.page}-${eIndex}`} className="text-sm">
                              <span className="font-medium text-text-primary">{evidence.documentName}</span>
                              <span className="text-text-secondary mx-2">Page {evidence.page}</span>
                              <span className="text-text-secondary">"{evidence.quote}"</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                    {attribute.status === 'CONFLICT' && attribute.evidence.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="clay-surface-sm p-4 border-l-4 border-status-warning"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <AlertTriangle className="w-4 h-4 text-status-warning" />
                          <span className="font-medium text-text-primary">Current Value (Conflict)</span>
                          <StatusChip status="CONFLICT" size="sm" />
                        </div>
                        <div className="ml-7 space-y-2">
                          {attribute.evidence.map((evidence, eIndex) => (
                            <div key={`${evidence.documentId}-${evidence.page}-${eIndex}`} className="text-sm">
                              <span className="font-medium text-text-primary">{evidence.documentName}</span>
                              <span className="text-text-secondary mx-2">Page {evidence.page}</span>
                              <span className="text-text-secondary">"{evidence.quote}"</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </section>
              )}

              {attribute.status === 'INFERRED' && attribute.evidence.length === 0 && (
                <section>
                  <div className="clay-surface-sm p-4 border-l-4 border-status-warning">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-status-warning" />
                      <div>
                        <p className="font-medium text-text-primary">AI Inferred Value</p>
                        <p className="text-sm text-text-secondary">
                          This value was derived by AI analysis and is not directly stated in the source documents.
                          No direct evidence quote is available.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {attribute.status === 'UNKNOWN' && (
                <section>
                  <div className="clay-surface-sm p-4 border-l-4 border-text-secondary">
                    <div className="flex items-center gap-3">
                      <MinusCircle className="w-4 h-4 text-text-secondary" />
                      <div>
                        <p className="font-medium text-text-primary">No Reliable Information</p>
                        <p className="text-sm text-text-secondary">
                          No reliable value could be found for this attribute in the uploaded documents.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function WhyButton({
  attribute,
  onClick,
  className,
}: {
  attribute: ProductAttribute;
  onClick: () => void;
  className?: string;
}) {
  const showWhy = attribute.status !== 'UNKNOWN' || attribute.evidence.length > 0;

  if (!showWhy) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
        'bg-clay-deep text-text-primary hover:bg-clay-secondary transition-colors',
        className
      )}
      aria-label={`View evidence for ${attribute.label}`}
    >
      <Hash className="w-3.5 h-3.5" />
      <span>Why?</span>
    </button>
  );
}