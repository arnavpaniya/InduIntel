'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessingStage {
  stage: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
}

interface UploadScreenProps {
  onUpload: (files: File[]) => Promise<void>;
  isProcessing?: boolean;
  stages?: ProcessingStage[];
  onClose?: () => void;
}

const STAGE_ORDER = [
  { key: 'Upload', label: 'UPLOADED' },
  { key: 'Reading', label: 'EXTRACTED' },
  { key: 'Understanding', label: 'UNDERSTANDING' },
  { key: 'Validating', label: 'VALIDATING' },
  { key: 'Ready', label: 'READY' },
];

export function UploadScreen({ onUpload, isProcessing, stages = [], onClose }: UploadScreenProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(file => {
      const validTypes = ['application/pdf', 'text/csv', 'text/plain'];
      const validExts = ['.pdf', '.csv', '.txt'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return validTypes.includes(file.type) && validExts.includes(ext) && file.size <= 50 * 1024 * 1024;
    });

    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(file => {
      const validTypes = ['application/pdf', 'text/csv', 'text/plain'];
      const validExts = ['.pdf', '.csv', '.txt'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return validTypes.includes(file.type) && validExts.includes(ext) && file.size <= 50 * 1024 * 1024;
    });
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;
    await onUpload(selectedFiles);
    setSelectedFiles([]);
  };

  const getStageStatus = (stageName: string) => {
    const stage = stages.find(s => s.stage === stageName);
    return stage?.status || 'pending';
  };

  // Section 14 Processing timeline: plain list
  if (isProcessing || stages.length > 0) {
    return (
      <div className="space-y-6 font-mono text-xs">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 border border-border rounded hover:border-accent text-text-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="border-b border-border pb-3">
          <div className="text-[11px] uppercase tracking-wider text-text-secondary">DOCUMENT PROCESSING TIMELINE</div>
        </div>

        <div className="space-y-2 py-2">
          {STAGE_ORDER.map((item) => {
            const status = getStageStatus(item.key);
            const isComplete = status === 'completed';
            const isProcessing = status === 'processing';
            const isFailed = status === 'failed';

            let bracketContent = ' ';
            let textClass = 'text-text-muted';

            if (isComplete) {
              bracketContent = '✓';
              textClass = 'text-status-verified font-medium';
            } else if (isProcessing) {
              bracketContent = '●';
              textClass = 'text-accent font-medium';
            } else if (isFailed) {
              bracketContent = '✕';
              textClass = 'text-status-conflict font-medium';
            }

            return (
              <div key={item.key} className="flex items-center gap-2">
                <span className={isProcessing ? 'text-accent animate-pulse' : isComplete ? 'text-status-verified' : 'text-text-muted'}>
                  [{bracketContent}]
                </span>
                <span className={textClass}>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 font-sans"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 border border-border rounded hover:border-accent text-text-secondary"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Section 14 Dropzone */}
      <div
        className={cn(
          'p-8 text-center relative border border-dashed rounded-md bg-surface-raised transition-colors cursor-pointer',
          dragActive ? 'border-accent bg-surface-hover' : 'border-border hover:border-accent/50'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.csv,.txt"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Upload product documents"
        />

        <div className="space-y-3">
          <div className="inline-flex items-center justify-center w-10 h-10 border border-border bg-background rounded-md text-text-secondary">
            <Plus className="w-5 h-5 text-accent" />
          </div>

          <div className="text-sm font-mono font-medium text-text-primary uppercase tracking-wider">
            DROP PRODUCT DOCUMENTS HERE
          </div>

          <div className="text-xs font-mono text-text-secondary">
            PDF / CSV / TXT
          </div>

          <div className="pt-2">
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="clay-button-secondary text-xs font-mono uppercase inline-flex items-center gap-2 px-4 py-2"
            >
              <Upload className="w-3.5 h-3.5" />
              BROWSE FILES
            </button>
          </div>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-3 font-mono text-xs">
          <div className="text-text-secondary uppercase">SELECTED FILES ({selectedFiles.length})</div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="command-panel-raised p-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-text-primary truncate">{file.name}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                  className="text-text-secondary hover:text-status-conflict p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="clay-button w-full text-xs font-mono uppercase py-3"
          >
            UPLOAD & ANALYZE {selectedFiles.length} FILE{selectedFiles.length > 1 ? 'S' : ''}
          </button>
        </div>
      )}
    </div>
  );
}