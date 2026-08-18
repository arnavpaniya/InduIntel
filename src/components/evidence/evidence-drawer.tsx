'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, AlertTriangle } from 'lucide-react';
import { ProductAttribute } from '@/types';
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
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Dim Scrim Backdrop (Section 12: no blur, dim scrim rgba(0,0,0,0.6)) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60"
            onClick={onClose}
          />

          {/* Right Slide-in Panel #171B21 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-md bg-surface-raised border-l border-border h-full overflow-y-auto z-10 flex flex-col justify-between font-sans shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Header */}
              <div className="p-6 border-b border-border flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">EVIDENCE & PROVENANCE</div>
                  <h2 className="text-lg font-mono font-medium text-text-primary uppercase">
                    {attribute.label || attribute.key}
                  </h2>
                  <div className="text-xl font-mono text-text-primary pt-1">
                    {attribute.value !== null ? `${attribute.value} ${attribute.unit || ''}`.trim() : '—'}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <StatusChip status={attribute.status} size="sm" />
                    <span className="text-xs font-mono text-text-secondary">
                      {Math.round(attribute.confidence * 100)}% CONFIDENCE
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 border border-border rounded hover:border-accent hover:text-accent transition-colors text-text-secondary"
                  aria-label="Close evidence drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {attribute.evidence.length > 0 && (
                  <section className="space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary border-b border-border pb-1">
                      ── SOURCE ──
                    </div>
                    {attribute.evidence.map((ev, i) => (
                      <div key={i} className="space-y-2 font-mono text-xs">
                        <div className="flex items-center gap-2 text-text-secondary">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{ev.documentName}</span>
                          <span>·</span>
                          <span>page {String(ev.page).padStart(2, '0')}</span>
                        </div>
                        <blockquote className="p-3 bg-background border-l-2 border-status-verified text-text-primary leading-relaxed italic">
                          "{ev.quote}"
                        </blockquote>
                      </div>
                    ))}
                  </section>
                )}

                {hasConflicts && (
                  <section className="space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-status-conflict border-b border-border pb-1 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      ── CONFLICTING SOURCE ──
                    </div>
                    {conflictAttrs.map((ca, idx) => (
                      <div key={idx} className="space-y-2 font-mono text-xs">
                        {ca.evidence.map((ev, i) => (
                          <div key={i} className="space-y-2">
                            <div className="flex items-center gap-2 text-text-secondary">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{ev.documentName}</span>
                              <span>·</span>
                              <span>page {String(ev.page).padStart(2, '0')}</span>
                            </div>
                            <blockquote className="p-3 bg-background border-l-2 border-status-conflict text-text-primary leading-relaxed italic">
                              "{ev.quote}"
                            </blockquote>
                          </div>
                        ))}
                      </div>
                    ))}
                    <div className="text-xs font-mono text-status-conflict font-medium">
                      ▲ CONFLICT DETECTED
                    </div>
                  </section>
                )}

                {attribute.status === 'INFERRED' && attribute.evidence.length === 0 && (
                  <div className="p-3 bg-background border-l-2 border-status-inferred font-mono text-xs space-y-1">
                    <div className="text-status-inferred font-medium">◐ AI INFERRED VALUE</div>
                    <div className="text-text-secondary leading-relaxed">
                      Derived by AI model analysis. No direct quote available in source document.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-border font-mono text-[11px] text-text-muted">
              INDUINTEL EVIDENCE ENGINE · DETERMINISTIC PROVENANCE
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}