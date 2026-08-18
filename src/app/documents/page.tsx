'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, CheckCircle, Clock, Upload, AlertCircle, RefreshCw } from 'lucide-react';
import { ClayCard } from '@/components/ui/clay-card';
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
              <h1 className="text-xl font-bold text-text-primary tracking-tight">Ingested Documents</h1>
              <p className="text-xs text-text-secondary">Source PDF, CSV, and text files parsed into intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDocuments}
              className="p-2 clay-surface-sm rounded-lg hover:bg-clay-deep transition-colors text-text-secondary"
              title="Refresh Documents"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link href="/dashboard" className="clay-button inline-flex items-center gap-2 text-sm">
              <Upload className="w-4 h-4" />
              Upload New Document
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Document Library ({documents.length})</h2>
        </div>

        {loading ? (
          <div className="clay-surface p-12 text-center text-text-secondary">
            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
            Loading documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="clay-surface p-12 text-center space-y-4">
            <FileText className="w-12 h-12 text-text-secondary/50 mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-text-primary">No documents uploaded yet</h3>
              <p className="text-sm text-text-secondary">Upload product datasheets from the dashboard to get started.</p>
            </div>
            <Link href="/dashboard" className="clay-button inline-flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc, index) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ClayCard className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-3 clay-surface-secondary rounded-xl flex-shrink-0">
                      <FileText className="w-6 h-6 text-text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-text-primary truncate">{doc.originalName}</h3>
                      <p className="text-xs text-text-secondary">
                        {(doc.size / 1024 / 1024).toFixed(2)} MB · Format: {doc.type.toUpperCase()} · Ingested {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      doc.status === 'completed'
                        ? 'bg-status-verified/10 text-status-verified'
                        : doc.status === 'processing'
                        ? 'bg-status-warning/10 text-status-warning'
                        : 'bg-status-conflict/10 text-status-conflict'
                    }`}>
                      {doc.status === 'completed' ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Parsed & Extracted
                        </>
                      ) : doc.status === 'processing' ? (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5" />
                          Failed
                        </>
                      )}
                    </span>
                  </div>
                </ClayCard>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
