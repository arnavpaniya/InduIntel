'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertTriangle, Cpu, Layers, ArrowRight, RefreshCw } from 'lucide-react';
import { ClayCard } from '@/components/ui/clay-card';
import { UploadScreen } from '@/components/dashboard/upload-screen';
import { ProductHealthCard } from '@/components/products/product-health-card';
import { Product, Document } from '@/types';

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stages, setStages] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [resProducts, resDocs] = await Promise.all([
        fetch('/api/products').then(r => r.json()),
        fetch('/api/documents').then(r => r.json()),
      ]);

      if (Array.isArray(resProducts.products)) {
        setProducts(resProducts.products);
      }
      if (Array.isArray(resDocs.documents)) {
        setDocuments(resDocs.documents);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUploadFiles = async (files: File[]) => {
    try {
      setIsProcessing(true);
      setStages([
        { stage: 'Upload', status: 'processing', message: 'Uploading document...' },
        { stage: 'Reading', status: 'pending' },
        { stage: 'Understanding', status: 'pending' },
        { stage: 'Validating', status: 'pending' },
        { stage: 'Ready', status: 'pending' },
      ]);

      const formData = new FormData();
      formData.append('file', files[0]);

      const uploadRes = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      setStages([
        { stage: 'Upload', status: 'completed', message: 'Uploaded' },
        { stage: 'Reading', status: 'processing', message: 'Reading text & preserving pages...' },
        { stage: 'Understanding', status: 'pending' },
        { stage: 'Validating', status: 'pending' },
        { stage: 'Ready', status: 'pending' },
      ]);

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: uploadData.id }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Analysis failed');

      setStages([
        { stage: 'Upload', status: 'completed' },
        { stage: 'Reading', status: 'completed' },
        { stage: 'Understanding', status: 'completed' },
        { stage: 'Validating', status: 'completed' },
        { stage: 'Ready', status: 'completed', message: 'Product intelligence generated!' },
      ]);

      setTimeout(() => {
        setIsProcessing(false);
        setShowUploadModal(false);
        setStages([]);
        fetchDashboardData();
      }, 1200);

    } catch (err: any) {
      console.error('Processing error:', err);
      setStages(prev => prev.map((s, i) => i === 1 || i === 2 ? { ...s, status: 'failed', message: err.message } : s));
      setTimeout(() => setIsProcessing(false), 3000);
    }
  };

  const totalProducts = products.length;
  const avgCompleteness = totalProducts ? Math.round(products.reduce((acc, p) => acc + (p.completeness || 0), 0) / totalProducts) : 0;
  const avgConfidence = totalProducts ? Math.round(products.reduce((acc, p) => acc + (p.confidence || 0), 0) / totalProducts) : 0;
  const totalConflicts = products.reduce((acc, p) => acc + (p.conflicts?.length || 0), 0);

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Header */}
      <header className="border-b border-clay-deep/30 bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold tracking-tight text-text-primary">
              InduIntel
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link href="/dashboard" className="text-text-primary font-bold border-b-2 border-text-primary pb-1">
                Dashboard
              </Link>
              <Link href="/documents" className="text-text-secondary hover:text-text-primary transition-colors">
                Documents ({documents.length})
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              className="p-2 clay-surface-sm rounded-lg hover:bg-clay-deep transition-colors text-text-secondary"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="clay-button inline-flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ClayCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Products Analyzed</span>
              <Cpu className="w-5 h-5 text-text-secondary" />
            </div>
            <div className="text-4xl font-bold text-text-primary mb-1">{totalProducts}</div>
            <p className="text-xs text-text-secondary">Extracted across categories</p>
          </ClayCard>

          <ClayCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Avg Completeness</span>
              <CheckCircle className="w-5 h-5 text-status-verified" />
            </div>
            <div className="text-4xl font-bold text-status-verified mb-1">{avgCompleteness}%</div>
            <p className="text-xs text-text-secondary">Schema attributes populated</p>
          </ClayCard>

          <ClayCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Avg Confidence</span>
              <Layers className="w-5 h-5 text-text-primary" />
            </div>
            <div className="text-4xl font-bold text-text-primary mb-1">{avgConfidence}%</div>
            <p className="text-xs text-text-secondary">AI provenance quality</p>
          </ClayCard>

          <ClayCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Active Conflicts</span>
              <AlertTriangle className="w-5 h-5 text-status-conflict" />
            </div>
            <div className="text-4xl font-bold text-status-conflict mb-1">{totalConflicts}</div>
            <p className="text-xs text-text-secondary">Cross-source discrepancies</p>
          </ClayCard>
        </section>

        {/* Action & Recent Products Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Quick Upload Dropzone */}
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-xl font-bold text-text-primary">Ingest Document</h2>
            <div className="clay-surface p-6 rounded-clay">
              <UploadScreen
                onUpload={handleUploadFiles}
                isProcessing={isProcessing}
                stages={stages}
              />
            </div>
          </div>

          {/* Right Column: Products List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">Product Intelligence</h2>
              <span className="text-xs text-text-secondary">{products.length} Products</span>
            </div>

            {loading ? (
              <div className="clay-surface p-12 text-center text-text-secondary">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
                Loading product intelligence...
              </div>
            ) : products.length === 0 ? (
              <div className="clay-surface p-12 text-center text-text-secondary space-y-4">
                <FileText className="w-12 h-12 mx-auto text-text-secondary/50" />
                <div>
                  <h3 className="text-lg font-bold text-text-primary">No products extracted yet</h3>
                  <p className="text-sm">Upload a PDF datasheet, CSV, or technical manual to generate product intelligence.</p>
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="clay-button inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload First Document
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {products.map(product => (
                  <motion.div key={product.id} layout>
                    <ProductHealthCard product={product} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="clay-surface p-8 max-w-xl w-full rounded-clay relative max-h-[90vh] overflow-y-auto">
            <UploadScreen
              onUpload={handleUploadFiles}
              isProcessing={isProcessing}
              stages={stages}
              onClose={() => setShowUploadModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
