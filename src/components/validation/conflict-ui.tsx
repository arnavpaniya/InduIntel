'use client';

import { Conflict } from '@/types';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConflictCardProps {
  conflict: Conflict;
  onResolve?: (conflict: Conflict, value: string | number | null, unit: string | null) => void;
}

export function ConflictCard({ conflict, onResolve }: ConflictCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="command-panel p-6 border-l-4 border-l-status-conflict space-y-6 font-sans"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="text-[11px] font-mono text-status-conflict uppercase tracking-wider font-medium flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            ▲ SPECIFICATION CONFLICT
          </div>
          <h3 className="text-lg font-mono font-medium text-text-primary uppercase mt-1">
            {conflict.attributeKey.replace(/_/g, ' ')}
          </h3>
        </div>

        {conflict.requiresHumanReview && (
          <div className="text-xs font-mono text-accent uppercase border border-accent/40 bg-accent/10 px-2.5 py-1 rounded">
            ⚠ HUMAN VERIFICATION REQUIRED
          </div>
        )}
      </div>

      {/* Grid of competing values */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {conflict.values.map((v, idx) => (
          <div key={idx} className="command-panel-raised p-4 space-y-2 font-mono text-xs">
            <div className="text-xl font-medium text-text-primary">
              {v.value} {v.unit || ''}
            </div>
            <div className="text-text-secondary">
              SOURCE: {v.source.documentName} · PAGE {v.source.page}
            </div>
            <blockquote className="text-text-muted italic border-l border-border pl-2 mt-1">
              "{v.source.quote}"
            </blockquote>
          </div>
        ))}
      </div>

      {/* Recommended value summary */}
      <div className="pt-4 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs">
        <div>
          <span className="text-text-secondary uppercase">RECOMMENDED VALUE: </span>
          <span className="text-text-primary font-medium text-sm">
            {conflict.recommendedValue} {conflict.recommendedUnit || ''}
          </span>
          <div className="text-text-muted text-[11px] mt-0.5">
            {Math.round(conflict.confidence * 100)}% APPLICATION CONFIDENCE
          </div>
        </div>

        {onResolve && (
          <button
            onClick={() => onResolve(conflict, conflict.recommendedValue, conflict.recommendedUnit)}
            className="clay-button text-xs font-mono uppercase inline-flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            ACCEPT RECOMMENDED
          </button>
        )}
      </div>
    </motion.div>
  );
}

export function ConflictList({ conflicts, onResolve }: { conflicts: Conflict[]; onResolve?: (conflict: Conflict, value: string | number | null, unit: string | null) => void }) {
  if (conflicts.length === 0) {
    return (
      <div className="command-panel p-12 text-center font-mono">
        <CheckCircle className="w-10 h-10 mx-auto text-status-verified mb-3" />
        <h3 className="text-base font-medium text-text-primary uppercase">NO CONFLICTS DETECTED</h3>
        <p className="text-xs text-text-secondary mt-1">All extracted specifications are consistent across uploaded source documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {conflicts.map(conflict => (
        <ConflictCard key={conflict.id} conflict={conflict} onResolve={onResolve} />
      ))}
    </div>
  );
}

export const ConflictUI = ConflictList;