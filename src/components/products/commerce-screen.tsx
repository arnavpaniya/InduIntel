'use client';

import { CommerceOutput } from '@/types';
import { motion } from 'framer-motion';
import { Copy, Download, FileText, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface CommerceScreenProps {
  commerce: CommerceOutput | null;
  productId: string;
  onCopy?: () => void;
}

export function CommerceScreen({ commerce, productId, onCopy }: CommerceScreenProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [currentCommerce, setCurrentCommerce] = useState<CommerceOutput | null>(commerce);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await fetch(`/api/products/${productId}/commerce`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCurrentCommerce(data);
      }
    } catch (err) {
      console.error('Failed to generate commerce listing:', err);
    } finally {
      setGenerating(false);
    }
  };

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

  if (!currentCommerce) {
    return (
      <div className="command-panel p-12 text-center font-sans space-y-4">
        <FileText className="w-10 h-10 mx-auto text-text-muted" />
        <div>
          <h3 className="text-base font-medium text-text-primary uppercase font-mono">NO COMMERCE LISTING GENERATED</h3>
          <p className="text-xs text-text-secondary font-mono mt-1">Generate a B2B commerce-ready title, description, and keywords from validated specs.</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="clay-button inline-flex items-center gap-2 text-xs font-mono uppercase"
        >
          {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          {generating ? 'GENERATING LISTING...' : 'GENERATE COMMERCE LISTING'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="command-panel p-6 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="text-[11px] font-mono text-text-secondary uppercase tracking-wider">
            COMMERCE-READY PRODUCT INTELLIGENCE
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs font-mono text-text-secondary hover:text-accent inline-flex items-center gap-1.5 transition-colors uppercase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            REGENERATE
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-text-secondary block mb-1">
              PRODUCT TITLE
            </label>
            <p className="text-xl font-mono font-medium text-text-primary">{currentCommerce.title}</p>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-text-secondary block mb-1">
              SHORT DESCRIPTION
            </label>
            <p className="text-sm font-sans text-text-secondary leading-relaxed">{currentCommerce.shortDescription}</p>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-text-secondary block mb-1">
              DETAILED DESCRIPTION
            </label>
            <div className="command-panel-raised p-4 text-sm font-sans text-text-primary leading-relaxed">
              {currentCommerce.longDescription}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-text-secondary block mb-1">
              TECHNICAL SPECIFICATIONS
            </label>
            <div className="command-panel-raised overflow-hidden">
              <table className="w-full text-left font-mono text-xs">
                <tbody className="divide-y divide-border">
                  {currentCommerce.technicalSpecifications.map((spec) => (
                    <tr key={spec.key} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-2.5 text-text-secondary uppercase w-1/3">{spec.label}</td>
                      <td className="px-4 py-2.5 text-text-primary">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-text-secondary block mb-1">
              KEYWORDS
            </label>
            <div className="flex flex-wrap gap-2">
              {currentCommerce.keywords.map((kw) => (
                <span key={kw} className="px-2.5 py-1 command-panel-raised border border-border text-xs font-mono text-text-secondary">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Buttons (Section 16: outlined amber text, fill amber only on primary COPY LISTING action) */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={() => handleCopy(
              `${currentCommerce.title}\n\n${currentCommerce.shortDescription}\n\n${currentCommerce.longDescription}\n\nSpecifications:\n${currentCommerce.technicalSpecifications.map(s => `${s.label}: ${s.value}`).join('\n')}\n\nKeywords: ${currentCommerce.keywords.join(', ')}`,
              'full'
            )}
            className="clay-button w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-mono uppercase px-6 py-2.5"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied === 'full' ? 'COPIED TO CLIPBOARD' : 'COPY LISTING'}
          </button>

          <a
            href={`/api/products/${productId}/export?format=json`}
            download
            className="clay-button-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-mono uppercase px-6 py-2.5"
          >
            <FileText className="w-3.5 h-3.5" />
            EXPORT JSON
          </a>

          <a
            href={`/api/products/${productId}/export?format=csv`}
            download
            className="clay-button-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-mono uppercase px-6 py-2.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            EXPORT CSV
          </a>
        </div>
      </motion.div>
    </div>
  );
}