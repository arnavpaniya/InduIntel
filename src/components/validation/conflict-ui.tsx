'use client';

import { Conflict, ConflictSeverity } from '@/types';
import { cn, getSeverityColor } from '@/lib/utils';
import { AlertTriangle, AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConflictCardProps {
  conflict: Conflict;
  onResolve?: (conflict: Conflict, value: string | number | null, unit: string | null) => void;
}

export function ConflictCard({ conflict, onResolve }: ConflictCardProps) {
  const severity = conflict.severity;
  const severityColors = {
    HIGH: 'border-status-conflict bg-status-conflict/5',
    MEDIUM: 'border-status-warning bg-status-warning/5',
    LOW: 'border-text-secondary bg-text-secondary/5',
  };

  const severityIcons = {
    HIGH: AlertTriangle,
    MEDIUM: AlertCircle,
    LOW: Info,
  };

  const SeverityIcon = severityIcons[severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('clay-surface p-6 rounded-clay-lg border-l-4', severityColors[severity])}
    >
      <div className="flex items-start gap-4 mb-4">
        <SeverityIcon className={cn('w-6 h-6 flex-shrink-0 mt-0.5', getSeverityColor(severity))} />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-bold text-text-primary">{conflict.attributeKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3>
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium uppercase', getSeverityColor(severity), `bg-${severity.toLowerCase()}/10`)}>{severity}</span>
            {conflict.requiresHumanReview && (
              <span className="px-2 py-0.5 rounded text-xs font-medium text-status-warning bg-status-warning/10">Review Required</span>
            )}
          </div>
          <p className="text-sm text-text-secondary">
            {conflict.values.length} source{conflict.values.length > 1 ? 's' : ''} provide different values.
            Recommended: <strong className="text-text-primary">{conflict.recommendedValue} {conflict.recommendedUnit || ''}</strong>
            ({Math.round(conflict.confidence * 100)}% confidence)
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {conflict.values.map((value, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="clay-surface-sm p-4 flex items-center gap-4"
          >
            <div className="flex-1">
              <div className="font-mono text-lg font-medium text-text-primary">
                {value.value} {value.unit || ''}
              </div>
              <div className="text-sm text-text-secondary">
                {value.source.documentName}, Page {value.source.page}
              </div>
              <blockquote className="text-xs text-text-secondary mt-1 italic border-l-2 border-clay-deep pl-2">
                "{value.source.quote}"
              </blockquote>
            </div>
            <span className={cn('px-3 py-1 rounded text-sm font-medium', index === 0 ? 'text-status-verified bg-status-verified/10' : 'text-text-secondary bg-clay-deep')}>
              {index === 0 ? 'Recommended' : `Source ${index + 1}`}
            </span>
          </motion.div>
        ))}
      </div>

      {onResolve && (
        <div className="pt-4 border-t border-clay-deep/30">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-text-secondary">Resolve with:</label>
            <input
              type="text"
              defaultValue={`${conflict.recommendedValue} ${conflict.recommendedUnit || ''}`.trim()}
              className="clay-input flex-1 max-w-xs"
              placeholder="Enter resolved value"
            />
            <button
              onClick={() => onResolve(conflict, conflict.recommendedValue, conflict.recommendedUnit)}
              className="clay-button-sm px-4 py-2 text-sm"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Accept Recommended
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function ConflictList({ conflicts, onResolve }: { conflicts: Conflict[]; onResolve?: (conflict: Conflict, value: string | number | null, unit: string | null) => void }) {
  if (conflicts.length === 0) {
    return (
      <div className="clay-surface p-12 text-center">
        <CheckCircle className="w-12 h-12 mx-auto text-status-verified mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-2">No Conflicts Detected</h3>
        <p className="text-text-secondary">All specifications are consistent across sources.</p>
      </div>
    );
  }

  const highSeverity = conflicts.filter(c => c.severity === 'HIGH');
  const mediumSeverity = conflicts.filter(c => c.severity === 'MEDIUM');
  const lowSeverity = conflicts.filter(c => c.severity === 'LOW');

  return (
    <div className="space-y-4">
      {highSeverity.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-status-conflict uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            High Severity ({highSeverity.length})
          </h3>
          <div className="space-y-4">
            {highSeverity.map(conflict => (
              <ConflictCard key={conflict.id} conflict={conflict} onResolve={onResolve} />
            ))}
          </div>
        </section>
      )}
      {mediumSeverity.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-status-warning uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Medium Severity ({mediumSeverity.length})
          </h3>
          <div className="space-y-4">
            {mediumSeverity.map(conflict => (
              <ConflictCard key={conflict.id} conflict={conflict} onResolve={onResolve} />
            ))}
          </div>
        </section>
      )}
      {lowSeverity.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Low Severity ({lowSeverity.length})
          </h3>
          <div className="space-y-4">
            {lowSeverity.map(conflict => (
              <ConflictCard key={conflict.id} conflict={conflict} onResolve={onResolve} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export const ConflictUI = ConflictList;