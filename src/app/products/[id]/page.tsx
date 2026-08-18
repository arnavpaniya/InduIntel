'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, AlertTriangle, FileText, Download, Share2, Layers } from 'lucide-react';
import { SpecificationTable } from '@/components/products/specification-table';
import { CommerceScreen } from '@/components/products/commerce-screen';
import { ConflictUI } from '@/components/validation/conflict-ui';
import { CircularProgress } from '@/components/ui/status-chip';
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
      <div className="min-h-screen bg-background text-text-primary flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-text-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary font-medium">Loading product profile...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background text-text-primary flex items-center justify-center p-6">
        <div className="clay-surface p-12 text-center max-w-md w-full space-y-4">
          <FileText className="w-12 h-12 text-text-secondary mx-auto" />
          <h2 className="text-2xl font-bold text-text-primary">Product Not Found</h2>
          <p className="text-text-secondary text-sm">The product record you requested could not be located.</p>
          <Link href="/dashboard" className="clay-button inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const conflictCount = product.conflicts?.length || 0;

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Header Bar */}
      <header className="border-b border-clay-deep/30 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 clay-surface-sm rounded-lg hover:bg-clay-deep transition-colors text-text-secondary"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-text-primary tracking-tight">{product.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-clay-deep text-text-primary">
                  {product.category.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {product.manufacturer} · {product.model}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`/api/products/${product.id}/export?format=json`}
              download
              className="clay-button-secondary inline-flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </a>
            <a
              href={`/api/products/${product.id}/export?format=csv`}
              download
              className="clay-button inline-flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Health & Completeness Banner */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="clay-surface p-6 flex items-center gap-6">
            <CircularProgress value={product.completeness} size={76} strokeWidth={7} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">Completeness Score</div>
              <div className="text-2xl font-bold text-text-primary">{product.completeness}%</div>
              <p className="text-xs text-text-secondary">Required schema attributes populated</p>
            </div>
          </div>

          <div className="clay-surface p-6 flex items-center gap-6">
            <CircularProgress value={product.confidence} size={76} strokeWidth={7} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">Confidence Score</div>
              <div className="text-2xl font-bold text-text-primary">{product.confidence}%</div>
              <p className="text-xs text-text-secondary">AI evidence & page provenance rating</p>
            </div>
          </div>

          <div className="clay-surface p-6 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">Cross-Source Conflicts</div>
              <div className={`text-2xl font-bold ${conflictCount > 0 ? 'text-status-conflict' : 'text-status-verified'}`}>
                {conflictCount} {conflictCount === 1 ? 'Conflict' : 'Conflicts'}
              </div>
              <p className="text-xs text-text-secondary">Discrepancies across datasheets</p>
            </div>
            {conflictCount > 0 && (
              <span className="p-3 bg-status-conflict/10 text-status-conflict rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </span>
            )}
          </div>
        </section>

        {/* Tab Navigation */}
        <section className="space-y-6">
          <div className="flex border-b border-clay-deep/30 gap-8">
            <button
              onClick={() => setActiveTab('specifications')}
              className={`pb-4 font-semibold text-sm transition-all border-b-2 ${
                activeTab === 'specifications'
                  ? 'border-text-primary text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Specifications & Provenance ({product.attributes.length})
            </button>

            <button
              onClick={() => setActiveTab('conflicts')}
              className={`pb-4 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'conflicts'
                  ? 'border-text-primary text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Cross-Source Conflicts
              {conflictCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-status-conflict text-white">
                  {conflictCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('commerce')}
              className={`pb-4 font-semibold text-sm transition-all border-b-2 ${
                activeTab === 'commerce'
                  ? 'border-text-primary text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              Commerce Listing Output
            </button>
          </div>

          {/* Active Tab Panel */}
          {activeTab === 'specifications' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <SpecificationTable attributes={product.attributes} />
            </motion.div>
          )}

          {activeTab === 'conflicts' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <ConflictUI conflicts={product.conflicts || []} />
            </motion.div>
          )}

          {activeTab === 'commerce' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <CommerceScreen commerce={product.commerce} productId={product.id} />
            </motion.div>
          )}
        </section>
      </main>
    </div>
  );
}
