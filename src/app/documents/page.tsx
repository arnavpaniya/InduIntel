'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Upload, RefreshCw } from 'lucide-react';
import { Document } from '@/types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (Array.isArray(data.documents)) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div className="min-h-screen bg-background text-text-primary font-sans flex flex-col">
      {/* Header Bar */}
      <header className="border-b border-border bg-background px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-1.5 border border-border rounded hover:border-accent hover:text-accent transition-colors text-text-secondary"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-medium uppercase font-sans text-text-primary">INGESTED DOCUMENTS</h1>
            <p className="text-xs font-mono text-text-secondary">Source PDF, CSV, and TXT datasheets parsed into intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDocuments}
            className="p-2 border border-border rounded hover:border-accent hover:text-accent transition-colors text-text-secondary"
            title="Refresh Documents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/dashboard" className="clay-button inline-flex items-center gap-2 text-xs font-mono uppercase">
            <Upload className="w-4 h-4" />
            Upload Document
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-8 space-y-6 flex-1 w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">SOURCE FILES ({documents.length})</h2>
        </div>

        {loading ? (
          <div className="command-panel p-12 text-center font-mono text-xs text-text-secondary">
            <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin text-accent" />
            FETCHING INGESTED DOCUMENTS...
          </div>
        ) : documents.length === 0 ? (
          <div className="command-panel p-12 text-center font-sans space-y-4">
            <FileText className="w-10 h-10 text-text-muted mx-auto" />
            <div>
              <h3 className="text-base font-medium font-sans text-text-primary">No documents uploaded yet</h3>
              <p className="text-xs font-mono text-text-secondary mt-1">Upload datasheets from the dashboard to populate document library.</p>
            </div>
            <Link href="/dashboard" className="clay-button inline-flex items-center gap-2 text-xs font-mono uppercase">
              <Upload className="w-4 h-4" />
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-3 font-mono text-xs">
            {documents.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className="command-panel p-4 flex items-center justify-between gap-4 hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-accent shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-text-primary truncate">{doc.originalName}</h3>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      {(doc.size / 1024 / 1024).toFixed(2)} MB · FORMAT: {doc.type.toUpperCase()} · INGESTED {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2 py-0.5 border rounded uppercase font-medium text-[11px] ${
                    doc.status === 'completed'
                      ? 'border-status-verified/40 bg-status-verified/10 text-status-verified'
                      : doc.status === 'processing'
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-status-conflict/40 bg-status-conflict/10 text-status-conflict'
                  }`}>
                    {doc.status === 'completed' ? '● PARSED & EXTRACTED' : doc.status === 'processing' ? '◐ PROCESSING' : '▲ FAILED'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
