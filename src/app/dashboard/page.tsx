'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle, AlertTriangle, Cpu, Layers, RefreshCw } from 'lucide-react';
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
  const verifiedAttrsCount = products.reduce((acc, p) => acc + p.attributes.filter(a => a.status === 'VERIFIED').length, 0);
  const totalConflicts = products.reduce((acc, p) => acc + (p.conflicts?.length || 0), 0);

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-background flex flex-col justify-between shrink-0">
        <div className="p-6 space-y-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-mono font-bold tracking-wider text-text-primary uppercase">INDUINTEL</span>
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          </div>

          <nav className="space-y-1 font-mono text-xs uppercase tracking-wider">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 rounded bg-surface border-l-2 border-accent text-accent font-medium"
            >
              <span>▸ OVERVIEW</span>
            </Link>
            <Link
              href="/documents"
              className="flex items-center gap-3 px-3 py-2.5 text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
            >
              <span>DOCUMENTS ({documents.length})</span>
            </Link>
          </nav>
        </div>

        <div className="p-6 border-t border-border">
          <div className="text-[11px] font-mono text-text-muted uppercase">
            SYSTEM STATUS: ONLINE
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="border-b border-border bg-background px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium font-sans text-text-primary uppercase tracking-wide">OVERVIEW</h1>
            <p className="text-xs font-mono text-text-secondary">
              Product Intelligence · {totalConflicts > 0 ? `${totalConflicts} conflicts pending review` : 'All systems nominal'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              className="p-2 border border-border rounded hover:border-accent hover:text-accent transition-colors text-text-secondary"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="clay-button inline-flex items-center gap-2 text-xs font-mono uppercase"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-8 space-y-8 flex-1">
          {/* KPI Panels Section 8 */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="command-panel p-6 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">PRODUCTS ANALYZED</div>
              <div className="text-4xl font-mono font-medium text-text-primary">{totalProducts}</div>
            </div>

            <div className="command-panel p-6 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">COMPLETENESS</div>
              <div className="text-4xl font-mono font-medium text-status-verified">{avgCompleteness}%</div>
            </div>

            <div className="command-panel p-6 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">VERIFIED ATTRS</div>
              <div className="text-4xl font-mono font-medium text-text-primary">{verifiedAttrsCount.toLocaleString()}</div>
            </div>

            <div className="command-panel p-6 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">CONFLICTS</div>
              <div className={`text-4xl font-mono font-medium ${totalConflicts > 0 ? 'text-status-conflict' : 'text-text-primary'}`}>
                {String(totalConflicts).padStart(2, '0')}
              </div>
            </div>
          </section>

          {/* Action & Recent Products Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Quick Upload Dropzone */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">INGEST DOCUMENT</h2>
              <div className="command-panel p-6">
                <UploadScreen
                  onUpload={handleUploadFiles}
                  isProcessing={isProcessing}
                  stages={stages}
                />
              </div>
            </div>

            {/* Right Column: Products List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">PRODUCT RECORDS</h2>
                <span className="text-xs font-mono text-text-muted">{products.length} PRODUCTS</span>
              </div>

              {loading ? (
                <div className="command-panel p-12 text-center text-text-secondary font-mono text-xs">
                  <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-accent" />
                  FETCHING PRODUCT INTELLIGENCE...
                </div>
              ) : products.length === 0 ? (
                <div className="command-panel p-12 text-center space-y-4">
                  <FileText className="w-10 h-10 mx-auto text-text-muted" />
                  <div>
                    <h3 className="text-base font-sans font-medium text-text-primary">No product records extracted</h3>
                    <p className="text-xs font-mono text-text-secondary mt-1">Upload a PDF datasheet, CSV, or TXT document to generate intelligence.</p>
                  </div>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="clay-button inline-flex items-center gap-2 text-xs font-mono uppercase"
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
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-none flex items-center justify-center p-4">
          <div className="command-panel-raised p-8 max-w-xl w-full relative max-h-[90vh] overflow-y-auto">
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
