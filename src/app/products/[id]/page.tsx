'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { SpecificationTable } from '@/components/products/specification-table';
import { CommerceScreen } from '@/components/products/commerce-screen';
import { ConflictUI } from '@/components/validation/conflict-ui';
import { Product } from '@/types';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'specifications' | 'conflicts' | 'commerce'>('specifications');

  useEffect(() => {
    if (!id) return;

    fetch(`/api/products/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setProduct(data);
        }
      })
      .catch(err => console.error('Failed to fetch product:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-text-primary flex items-center justify-center font-mono text-xs">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary uppercase">LOADING PRODUCT PROFILE...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background text-text-primary flex items-center justify-center p-6 font-sans">
        <div className="command-panel p-12 text-center max-w-md w-full space-y-4">
          <FileText className="w-10 h-10 text-text-muted mx-auto" />
          <h2 className="text-xl font-medium text-text-primary">PRODUCT RECORD NOT FOUND</h2>
          <p className="text-text-secondary text-xs font-mono">The requested product record could not be located in database.</p>
          <Link href="/dashboard" className="clay-button inline-flex items-center gap-2 text-xs font-mono uppercase">
            <ArrowLeft className="w-4 h-4" />
            RETURN TO DASHBOARD
          </Link>
        </div>
      </div>
    );
  }

  const conflictCount = product.conflicts?.length || 0;

  return (
    <div className="min-h-screen bg-background text-text-primary font-sans flex flex-col">
      {/* Header Bar (Section 9) */}
      <header className="border-b border-border bg-background px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="text-xs font-mono text-text-secondary hover:text-accent inline-flex items-center gap-1.5 transition-colors uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              PRODUCTS
            </Link>
            <div>
              <h1 className="text-2xl font-mono font-medium text-text-primary tracking-tight">
                {product.name || `${product.manufacturer} ${product.model}`}
              </h1>
              <p className="text-xs font-mono text-text-secondary uppercase mt-0.5">
                {product.category.replace(/_/g, ' ')} · {product.manufacturer || 'Unknown Manufacturer'} · {product.model || 'Model N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="command-panel px-3 py-1.5 border border-border">
                <span className="text-text-secondary">COMPLETENESS: </span>
                <span className="text-status-verified font-medium">{product.completeness}%</span>
              </div>
              <div className="command-panel px-3 py-1.5 border border-border">
                <span className="text-text-secondary">CONFIDENCE: </span>
                <span className="text-text-primary font-medium">{product.confidence}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/api/products/${product.id}/export?format=json`}
                download
                className="clay-button-secondary text-xs font-mono uppercase inline-flex items-center gap-1.5 px-3 py-2"
              >
                <Download className="w-3.5 h-3.5" />
                JSON
              </a>
              <a
                href={`/api/products/${product.id}/export?format=csv`}
                download
                className="clay-button text-xs font-mono uppercase inline-flex items-center gap-1.5 px-3 py-2"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-8 flex-1 w-full">
        {/* Tabs (Section 9: Underline style, not pill) */}
        <section className="space-y-6">
          <div className="flex border-b border-border gap-8 font-mono text-xs uppercase tracking-wider">
            <button
              onClick={() => setActiveTab('specifications')}
              className={`pb-3 font-medium transition-colors ${
                activeTab === 'specifications'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              SPECIFICATIONS ({product.attributes.length})
            </button>

            <button
              onClick={() => setActiveTab('conflicts')}
              className={`pb-3 font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'conflicts'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              CONFLICTS
              {conflictCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-status-conflict text-background font-bold rounded">
                  {String(conflictCount).padStart(2, '0')}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('commerce')}
              className={`pb-3 font-medium transition-colors ${
                activeTab === 'commerce'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              COMMERCE LISTING
            </button>
          </div>

          {/* Active Tab Content */}
          {activeTab === 'specifications' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
              <SpecificationTable attributes={product.attributes} />
            </motion.div>
          )}

          {activeTab === 'conflicts' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
              <ConflictUI conflicts={product.conflicts || []} />
            </motion.div>
          )}

          {activeTab === 'commerce' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
              <CommerceScreen commerce={product.commerce} productId={product.id} />
            </motion.div>
          )}
        </section>
      </main>
    </div>
  );
}
