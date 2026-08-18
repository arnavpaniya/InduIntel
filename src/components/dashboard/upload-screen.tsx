'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClayCard } from '@/components/ui/clay-card';

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

const STAGE_ORDER = ['Upload', 'Reading', 'Understanding', 'Validating', 'Ready'];

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

  const getStageMessage = (stageName: string) => {
    const stage = stages.find(s => s.stage === stageName);
    return stage?.message;
  };

  if (isProcessing || stages.length > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 clay-surface-sm rounded-full hover:bg-clay-deep transition-colors text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 clay-surface rounded-2xl mb-4"
          >
            <Loader2 className="w-8 h-8 text-text-primary animate-spin" />
          </motion.div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Processing Document</h2>
          <p className="text-text-secondary">Analyzing and extracting product intelligence</p>
        </div>

        <div className="space-y-3">
          {STAGE_ORDER.map((stageName, index) => {
            const status = getStageStatus(stageName);
            const message = getStageMessage(stageName);
            const isCurrent = status === 'processing';
            const isComplete = status === 'completed';
            const isFailed = status === 'failed';

            return (
              <motion.div
                key={stageName}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn('flex items-center gap-4 p-4 clay-surface-sm rounded-clay', isCurrent && 'ring-2 ring-status-verified')}
              >
                <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', isComplete ? 'bg-status-verified' : isCurrent ? 'bg-status-warning animate-pulse' : isFailed ? 'bg-status-conflict' : 'bg-clay-deep')}>
                  {isComplete ? (
                    <CheckCircle className="w-5 h-5 text-background" />
                  ) : isFailed ? (
                    <AlertCircle className="w-5 h-5 text-background" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 text-background animate-spin" />
                  ) : (
                    <span className="text-text-secondary font-bold">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium', isComplete ? 'text-text-primary' : isCurrent ? 'text-status-warning' : isFailed ? 'text-status-conflict' : 'text-text-secondary')}>
                      {stageName}
                    </span>
                    {isCurrent && <span className="text-xs text-status-warning animate-pulse">●</span>}
                  </div>
                  {message && <p className="text-sm text-text-secondary mt-1">{message}</p>}
                </div>
                {isFailed && (
                  <AlertCircle className="w-5 h-5 text-status-conflict" />
                )}
              </motion.div>
            );
          })}
        </div>

        {stages.some(s => s.status === 'failed') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="clay-surface p-4 border-l-4 border-status-conflict"
          >
            <div className="flex items-center gap-3 text-status-conflict">
              <AlertCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">Processing Failed</p>
                <p className="text-sm text-text-secondary">
                  {stages.find(s => s.status === 'failed')?.message || 'An error occurred during processing.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 clay-surface-sm rounded-full hover:bg-clay-deep transition-colors text-text-secondary"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <ClayCard
        className={cn('p-12 text-center relative overflow-hidden', dragActive && 'ring-2 ring-status-verified bg-clay-secondary/50')}
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

        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 clay-surface-secondary rounded-2xl mb-6"
          >
            <Plus className="w-8 h-8 text-text-secondary" />
          </motion.div>

          <h2 className="text-2xl font-bold text-text-primary mb-2">Drop product documents here</h2>
          <p className="text-text-secondary mb-6">PDF / CSV / TXT · Up to 50MB each</p>

          <button
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="clay-button-secondary inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Browse files
          </button>

          <p className="mt-4 text-xs text-text-secondary">Or click to select files</p>
        </div>

        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-status-verified/10 flex items-center justify-center pointer-events-none"
          >
            <span className="text-status-verified font-medium">Drop to upload</span>
          </motion.div>
        )}
      </ClayCard>

      {selectedFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Selected Files ({selectedFiles.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="clay-surface-sm p-4 flex items-center gap-4"
              >
                <FileText className="w-8 h-8 text-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">{file.name}</p>
                  <p className="text-sm text-text-secondary">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                  className="p-2 clay-surface rounded-full hover:bg-clay-deep transition-colors text-text-secondary"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="clay-button w-full mt-4 py-4 text-lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Upload & Analyze {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}