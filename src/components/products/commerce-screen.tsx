'use client';

import { CommerceOutput } from '@/types';
import { ClayCard } from '@/components/ui/clay-card';
import { motion } from 'framer-motion';
import { Copy, Download, FileText, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CommerceScreenProps {
  commerce: CommerceOutput | null;
  productId: string;
  onExport?: (format: 'json' | 'csv', type: 'product' | 'commerce') => void;
  onCopy?: () => void;
}

export function CommerceScreen({ commerce, productId, onExport, onCopy }: CommerceScreenProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
      onCopy?.();
    } catch {
      // fallback
    }
  };

  if (!commerce) {
    return (
      <div className="clay-surface p-12 text-center">
        <FileText className="w-12 h-12 mx-auto text-text-secondary/50 mb-4" />
        <h3 className="text-lg font-medium text-text-primary mb-2">No Commerce Output</h3>
        <p className="text-text-secondary">Generate a commerce-ready listing from the product specifications.</p>
        <button className="clay-button mt-4" onClick={() => onExport?.('json', 'commerce')}>
          Generate Listing
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay-surface p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-text-primary">COMMERCE-READY</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(commerce.title, 'title')}
              className="p-2 clay-surface-sm rounded-lg hover:bg-clay-deep transition-colors text-text-secondary"
              title="Copy title"
            >
              <Copy className={cn('w-4 h-4', copied === 'title' && 'text-status-verified')} />
            </button>
            <button
              onClick={() => onExport?.('json', 'commerce')}
              className="p-2 clay-surface-sm rounded-lg hover:bg-clay-deep transition-colors text-text-secondary"
              title="Export JSON"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => onExport?.('csv', 'commerce')}
              className="p-2 clay-surface-sm rounded-lg hover:bg-clay-deep transition-colors text-text-secondary"
              title="Export CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">Product Title</label>
            <p className="text-2xl font-bold text-text-primary">{commerce.title}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">Short Description</label>
            <p className="text-text-secondary">{commerce.shortDescription}</p>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">Detailed Description</label>
            <div className="clay-surface-sm p-4 prose prose-sm max-w-none text-text-secondary">
              {commerce.longDescription}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">Technical Specifications</label>
            <div className="clay-surface-sm rounded-clay overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-clay-deep/30">
                  {commerce.technicalSpecifications.map((spec, index) => (
                    <tr key={spec.key} className={index % 2 === 0 ? 'bg-clay/30' : ''}>
                      <td className="px-4 py-3 font-medium text-text-primary w-1/3">{spec.label}</td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">Search Attributes</label>
            <div className="flex flex-wrap gap-2">
              {commerce.technicalSpecifications.map(spec => (
                <span key={spec.key} className="px-3 py-1 clay-surface-sm rounded-full text-sm text-text-secondary">
                  {spec.label}: {spec.value}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">Keywords</label>
            <div className="flex flex-wrap gap-2">
              {commerce.keywords.map(keyword => (
                <span key={keyword} className="px-3 py-1 bg-clay-deep rounded-full text-sm text-text-primary">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <button
          onClick={() => handleCopy(
            `${commerce.title}\n\n${commerce.shortDescription}\n\n${commerce.longDescription}\n\nSpecifications:\n${commerce.technicalSpecifications.map(s => `${s.label}: ${s.value}`).join('\n')}\n\nKeywords: ${commerce.keywords.join(', ')}`,
            'full-listing'
          )}
          className="clay-button flex-1"
        >
          <Copy className={cn('w-4 h-4 mr-2', copied === 'full-listing' && 'text-status-verified')} />
          {copied === 'full-listing' ? 'Copied!' : 'Copy Full Listing'}
        </button>
        <button
          onClick={() => onExport?.('json', 'commerce')}
          className="clay-button-secondary flex-1"
        >
          <Download className="w-4 h-4 mr-2" />
          Export JSON
        </button>
        <button
          onClick={() => onExport?.('csv', 'commerce')}
          className="clay-button-secondary flex-1"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </motion.div>
    </div>
  );
}

export function CommerceGenerator({ product }: { product: any }) {
  const verifiedAttrs = product.attributes.filter((a: any) => a.status === 'VERIFIED' && a.value !== null);
  const inferredAttrs = product.attributes.filter((a: any) => a.status === 'INFERRED' && a.value !== null);

  return (
    <div className="clay-surface p-6">
      <h3 className="text-lg font-bold text-text-primary mb-4">Generate Commerce Listing</h3>
      <p className="text-text-secondary mb-6">
        Create a commerce-ready product listing using {verifiedAttrs.length} verified and {inferredAttrs.length} inferred attributes.
        Attributes with conflicts or unknown status will be excluded.
      </p>
      <div className="flex items-center gap-4">
        <button className="clay-button">Generate Listing</button>
        <button className="clay-button-secondary">Preview</button>
      </div>
    </div>
  );
}