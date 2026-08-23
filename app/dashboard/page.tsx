'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'motion/react';
import { 
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  RefreshCw, Search, Filter, ChevronLeft, ChevronRight, 
  Zap, AlertTriangle, CheckCircle2, Clock, XCircle,
  BarChart2, Package, Eye,
  Upload, FileText, Plus, X, Loader2, HelpCircle,
  FileSpreadsheet, ArrowLeft, Download, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchItems, enrichItem, enrichBatch, fetchQuotaStatus, uploadItems, addManualItem } from '@/lib/api';
import { Item, QuotaStatus } from '@/lib/types';
import { useRouter, useSearchParams } from 'next/navigation';

const STATUS_BADGE_CONFIG: Record<Item['status'], { variant: 'success' | 'warning' | 'info' | 'gray'; label: string; sublabel: string; icon: any }> = {
  raw: {
    variant: 'gray',
    label: 'Not Cleaned Yet',
    sublabel: 'Raw feed data from supplier sheet',
    icon: Clock,
  },
  enriching: {
    variant: 'info',
    label: 'AI Cleaning In Progress...',
    sublabel: 'Currently extracting specs & descriptions',
    icon: Loader2,
  },
  enriched: {
    variant: 'success',
    label: 'Enriched',
    sublabel: 'Confidence ≥ 60% — completeness shown by score',
    icon: CheckCircle2,
  },
  review: {
    variant: 'warning',
    label: 'Needs Quick Check',
    sublabel: 'Partial enrichment — review recommended',
    icon: AlertTriangle,
  },
  failed: {
    variant: 'destructive' as any,
    label: 'Cleaning Failed',
    sublabel: 'Retry available from the product report',
    icon: XCircle,
  },
};

const REQUIRED_COLUMNS = [
  'Mfg_Part_Num',
  'Part_Desc',
  'E1_Brand',
  'Unilog_Brand',
  'DIB_Brand',
  'Part_Manuf',
];

function NonTechStatusBadge({ status }: { status: Item['status'] }) {
  const config = STATUS_BADGE_CONFIG[status] || STATUS_BADGE_CONFIG.raw;
  const Icon = config.icon;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className="gap-1.5 py-1 px-2.5 cursor-help text-xs font-semibold">
            <Icon className={cn('h-3.5 w-3.5', status === 'enriching' && 'animate-spin')} />
            <span>{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs bg-slate-900 text-slate-100">
          <p className="font-semibold mb-0.5">{config.label}</p>
          <p className="text-slate-300">{config.sublabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CompletenessBar({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-slate-400 font-mono">—</span>;
  }
  
  let colorClass = 'bg-emerald-600';
  let badgeVariant: 'success' | 'warning' | 'destructive' = 'success';
  if (score < 60) {
    colorClass = 'bg-amber-500';
    badgeVariant = 'warning';
  } else if (score < 40) {
    colorClass = 'bg-red-500';
    badgeVariant = 'destructive';
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help min-w-[110px]">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-500', colorClass)} style={{ width: `${score}%` }} />
            </div>
            <Badge variant={badgeVariant} className="text-[11px] font-mono py-0 px-1.5 font-bold">
              {score}%
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs bg-slate-900 text-slate-100">
          <p className="font-semibold">Data Completeness: {score}%</p>
          <p className="text-slate-300">Measures how many standard fields (brand, specs, 5 descriptions, category tree) have been successfully populated by AI.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

function ExecutiveCard({ label, value, description, icon: Icon, tone }: {
  label: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'neutral' | 'raw' | 'success' | 'review';
}) {
  return (
    <motion.div variants={panelVariants} layout>
      <Card className="clean-card overflow-hidden">
        <CardContent className="p-3 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs sm:text-sm font-semibold text-slate-500">{label}</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-xs bg-slate-900 text-slate-100">
                      {description}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="mt-0.5 text-2xl sm:text-xl font-extrabold font-display tracking-tight">
                {value}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlBatchId = searchParams.get('batch');
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus>({ available: false, used: null, limit: null, remaining: null, near_limit: false });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [dbStatusCounts, setDbStatusCountsFromDb] = useState<Record<string, number> | null>(null);
  
  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'csv' | 'manual' | 'pdf'>('csv');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [manualForm, setManualForm] = useState({
    mfg_part_num: '',
    part_desc: '',
    e1_brand: '',
    unilog_brand: '',
    dib_brand: '',
    part_manuf: '',
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchItems({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery || undefined,
        batch: urlBatchId || undefined,
      });
      setItems(data.items);
      setPagination(prev => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
      if (data.statusCounts) setDbStatusCountsFromDb(data.statusCounts);
    } catch (error) {
      console.error('Failed to load items:', error);
      showToast(`Failed to load catalog items`, 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, searchQuery, urlBatchId, showToast]);

  const loadQuota = useCallback(async () => {
    try {
      const status = await fetchQuotaStatus();
      setQuotaStatus(status);
    } catch (error) {
      console.error('Failed to load quota:', error);
      setQuotaStatus({ available: false, used: null, limit: null, remaining: null, near_limit: false });
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadQuota();
  }, [loadItems, loadQuota]);

  const handleEnrich = async (itemId: string) => {
    if (quotaStatus.near_limit) {
      showToast('Daily AI credit limit reached', 'error');
      return;
    }

    setEnrichingIds(prev => new Set(prev).add(itemId));
    try {
      const result = await enrichItem(itemId);
      if (result.success) {
        showToast(`Successfully cleaned product #${result.item.mfg_part_num}`, 'success');
        loadItems();
        loadQuota();
      } else {
        const stepResults = result.step_results;
        const firstFailedStep = Object.entries(stepResults).find(
          ([, step]) => !step.success
        );
        let errorMessage = 'Failed to clean item';
        if (firstFailedStep) {
          const [stepName, step] = firstFailedStep;
          const stepError = step.error || 'Unknown error';
          if (
            /429|quota|rate limit/i.test(stepError)
          ) {
            errorMessage = 'Daily AI limit reached — try again tomorrow or use a different key.';
          } else {
            errorMessage = `Failed at ${stepName}: ${stepError}`;
          }
        }
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Enrich failed:', error);
      showToast('Enrichment failed', 'error');
    } finally {
      setEnrichingIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleBatchEnrich = async () => {
    if (quotaStatus.near_limit) {
      showToast('Daily AI credit limit reached', 'error');
      return;
    }

    setBatchLoading(true);
    try {
      const result = await enrichBatch(3);
      if (result.success) {
        const { processed, enriched, needs_review, avg_confidence } = result.summary;
        showToast(
          `AI Batch Complete! Cleaned ${processed} products (${enriched} ready, ${needs_review} need quick check). Avg quality: ${avg_confidence}%`,
          'success'
        );
        loadItems();
        loadQuota();
      } else {
        showToast('Batch AI cleaning failed', 'error');
      }
    } catch (error) {
      console.error('Batch enrich failed:', error);
      showToast('Batch AI cleaning failed', 'error');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      showToast('Please select a CSV file', 'error');
      return;
    }
    setUploadLoading(true);
    try {
      const result = await uploadItems(csvFile, 'csv');
      showToast(`Uploaded ${result.count} products successfully!`, 'success');
      setUploadOpen(false);
      setCsvFile(null);
      router.push(`/dashboard?batch=${result.batchId}`);
    } catch (error) {
      console.error('CSV upload failed:', error);
      showToast(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handlePdfUpload = async () => {
    if (!pdfFile) {
      showToast('Please select a PDF file', 'error');
      return;
    }
    setUploadLoading(true);
    try {
      const result = await uploadItems(pdfFile, 'pdf');
      showToast(result.message, 'success');
      setUploadOpen(false);
      setPdfFile(null);
      router.push(`/dashboard?batch=${result.batchId}`);
    } catch (error) {
      console.error('PDF upload failed:', error);
      showToast(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.mfg_part_num.trim()) {
      showToast('Part Model # is required', 'error');
      return;
    }
    setUploadLoading(true);
    try {
      const result = await addManualItem(manualForm);
      showToast('Product added successfully!', 'success');
      setUploadOpen(false);
      setManualForm({
        mfg_part_num: '',
        part_desc: '',
        e1_brand: '',
        unilog_brand: '',
        dib_brand: '',
        part_manuf: '',
      });
      router.push(`/dashboard?batch=${result.batchId}`);
    } catch (error) {
      console.error('Manual entry failed:', error);
      showToast(error instanceof Error ? error.message : 'Failed to add item', 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  // Prefer DATABASE totals; fall back to current-page derivation.
  const statusCounts = dbStatusCounts ?? (() => {
    const counts = { raw: 0, enriching: 0, enriched: 0, review: 0, failed: 0 };
    items.forEach(item => counts[item.status] = (counts[item.status] ?? 0) + 1);
    return counts;
  })();

  const [exportLoading, setExportLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');

  const hasEnrichedItems = statusCounts.enriched + statusCounts.review > 0;

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!hasEnrichedItems) {
      showToast('Enrich at least one item first', 'error');
      return;
    }
    setExportLoading(true);
    setExportFormat(format);
    try {
      const params = new URLSearchParams();
      if (urlBatchId) params.set('batch_id', urlBatchId);
      params.set('format', format);
      
      const response = await fetch(`/api/export?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }
      
      const blob = await response.blob();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `induintel-export-${dateStr}.${format}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showToast(`Exported ${format.toUpperCase()} successfully!`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast(error instanceof Error ? error.message : 'Export failed', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-brand text-xl tracking-tight text-slate-900 hover:opacity-80 transition-opacity">
              InduIntel
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-xs font-semibold text-slate-600">Product Catalog Workspace</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/dashboard/insights">
              <Button variant="outline" size="sm" className="h-8 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 text-xs font-semibold">
                <BarChart2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>Insights & Accuracy</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2">
            <Card className={cn('w-80 shadow-lg border-slate-200 bg-white text-slate-900', toast.type === 'error' && 'border-red-300 bg-red-50 text-red-900')}>
              <CardContent className="p-4 flex items-center gap-3">
                {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
                {toast.type === 'error' && <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                <p className="text-xs font-semibold leading-snug">{toast.message}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-5 gap-2.5 pt-3"
        >
          <ExecutiveCard 
            label="Total Catalog Items" 
            value={pagination.total} 
            description="Total product records loaded"
            icon={Package} 
            tone="neutral" 
          />
          <ExecutiveCard 
            label="Enriched (confidence ≥ 60%)" 
            value={statusCounts.enriched} 
            description="Cleaned, categorized, & validated"
            icon={CheckCircle2} 
            tone="success" 
          />
          <ExecutiveCard 
            label="Needs Quick Check" 
            value={statusCounts.review} 
            description="Sparse data flagged for human review"
            icon={AlertTriangle} 
            tone="review" 
          />
<ExecutiveCard 
    label="Not Cleaned Yet" 
    value={statusCounts.raw} 
    description="Raw supplier feed waiting for AI"
    icon={Clock} 
    tone="raw" 
  />
  <ExecutiveCard 
    label="Cleaning Failed" 
    value={statusCounts.failed} 
    description="AI cleaning failed — retry from product report"
    icon={XCircle} 
    tone="neutral" 
  />
</motion.div>

        <motion.div
          variants={panelVariants}
          initial="hidden"
          animate="show"
          className="clean-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search part #, title, brand, or manufacturer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadItems()}
                className="pl-10 h-9 bg-white border-slate-300 text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-9 bg-white border-slate-300 text-xs font-semibold text-slate-700">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-800">
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="enriched">🟢 Enriched (confidence ≥ 60%)</SelectItem>
                <SelectItem value="review">🟡 Needs Quick Check</SelectItem>
                <SelectItem value="raw">⚪ Not Cleaned Yet</SelectItem>
                <SelectItem value="failed">🔴 Cleaning Failed</SelectItem>
              </SelectContent>
            </Select>

            {urlBatchId && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs border border-indigo-200 font-semibold">
                <Filter className="h-3 w-3" />
                <span>Batch: {urlBatchId.slice(0, 8)}...</span>
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-indigo-100" onClick={() => router.push('/dashboard')}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadItems}
              disabled={loading}
              className="h-9 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5 text-slate-500', loading && 'animate-spin')} />
              <span>Refresh</span>
            </Button>

            <Button 
              onClick={() => setUploadOpen(true)}
              className="h-9 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Upload className="h-3.5 w-3.5 text-indigo-600" />
              <span>Upload Catalog (CSV/PDF)</span>
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        onClick={() => handleExport(exportFormat)}
                        disabled={exportLoading || !hasEnrichedItems}
                        className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Export Results</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px] bg-white border-slate-200 text-slate-800">
                      <DropdownMenuItem
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold"
                        onClick={() => handleExport('csv')}
                        disabled={exportLoading}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Download CSV</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold"
                        onClick={() => handleExport('xlsx')}
                        disabled={exportLoading}
                      >
                        <FileText className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Download XLSX</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs bg-slate-900 text-slate-100">
                  {hasEnrichedItems 
                    ? `Export ${statusCounts.enriched + statusCounts.review} enriched item(s) to ${exportFormat.toUpperCase()}`
                    : 'Enrich at least one item first'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </motion.div>

        {/* Product Table */}
        <motion.div variants={panelVariants} initial="hidden" animate="show">
          <Card className="clean-card overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 border-b border-slate-200">
                  <TableRow className="border-slate-200 hover:bg-transparent">
                    <TableHead className="text-slate-600 text-xs font-bold">Model / Part #</TableHead>
                    <TableHead className="text-slate-600 text-xs font-bold">Product Description</TableHead>
                    <TableHead className="text-slate-600 text-xs font-bold">Manufacturer & Brand</TableHead>
                    <TableHead className="text-slate-600 text-xs font-bold">Catalog Status</TableHead>
                    <TableHead className="text-slate-600 text-xs font-bold">Data Completeness</TableHead>
                    <TableHead className="text-right text-slate-600 text-xs font-bold w-36">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Loader2 className="h-7 w-7 animate-spin mx-auto text-indigo-600 mb-2" />
                        <p className="text-xs text-slate-500 font-medium">Loading catalog items...</p>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <Package className="h-9 w-9 mx-auto text-slate-400 mb-2" />
                        <p className="text-sm font-semibold text-slate-800">No products match your current search</p>
                        <p className="text-xs text-slate-500 mt-1">Try resetting your search query or uploading new items.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50/80 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-indigo-700">
                          {item.mfg_part_num}
                        </TableCell>

                        <TableCell className="max-w-xs sm:max-w-sm">
                          <p className="text-xs font-medium text-slate-900 truncate">{item.part_desc || 'No raw description provided'}</p>
                          {item.classpath && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5 font-sans">
                              🌲 {item.classpath}
                            </p>
                          )}
                        </TableCell>

                        <TableCell>
                          {item.manufacturer_name ? (
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-slate-800 block">
                                {item.manufacturer_name}
                              </span>
                              {item.brand_name && item.brand_name !== item.manufacturer_name && (
                                <span className="text-[11px] text-indigo-600 block">Brand: {item.brand_name}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not available</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <NonTechStatusBadge status={item.status} />
                        </TableCell>

                        <TableCell>
                          <CompletenessBar score={item.confidence_score} />
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/dashboard/${item.id}`}>
                              <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs border-slate-300 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all font-semibold gap-1">
                                <Eye className="h-3 w-3" />
                                <span>Report</span>
                              </Button>
                            </Link>

                            {item.status === 'raw' && (
                              <Button
                                size="sm"
                                onClick={() => handleEnrich(item.id)}
                                disabled={enrichingIds.has(item.id) || quotaStatus.near_limit}
                                className="h-7 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1"
                              >
                                {enrichingIds.has(item.id) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <span>Clean</span>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
                  <span className="text-xs text-slate-600">
                    Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total items)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                      disabled={pagination.page === 1 || loading}
                      className="h-8 w-8 p-0 border-slate-300 bg-white text-slate-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="h-8 w-8 p-0 border-slate-300 bg-white text-slate-700"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {uploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white border border-slate-200 w-full max-w-xl rounded-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-bold text-slate-900 font-display">Upload Products</h2>
                <Button variant="ghost" size="sm" onClick={() => setUploadOpen(false)} className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex border-b border-slate-200 bg-slate-100/50">
                <button 
                  className={cn('flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5', uploadTab === 'csv' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900')}
                  onClick={() => setUploadTab('csv')}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  CSV File Upload
                </button>
                <button 
                  className={cn('flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5', uploadTab === 'manual' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900')}
                  onClick={() => setUploadTab('manual')}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Single Product Form
                </button>
                <button 
                  className={cn('flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5', uploadTab === 'pdf' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900')}
                  onClick={() => setUploadTab('pdf')}
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF Spec Sheet
                </button>
              </div>

              <div className="p-6">
                {uploadTab === 'csv' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-300 bg-slate-50 hover:border-indigo-400 transition-colors rounded-lg p-6 text-center cursor-pointer">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => e.target.files?.[0] && setCsvFile(e.target.files[0])}
                        className="hidden"
                        id="csv-file-input"
                        disabled={uploadLoading}
                      />
                      <label htmlFor="csv-file-input" className="cursor-pointer space-y-1 block">
                        <FileSpreadsheet className="h-8 w-8 mx-auto text-indigo-600 mb-1" />
                        <p className="text-xs font-semibold text-slate-800">Click or drag CSV file here</p>
                        <p className="text-[11px] text-slate-500">Columns: Mfg_Part_Num, Part_Desc, E1_Brand, Unilog_Brand, DIB_Brand, Part_Manuf</p>
                      </label>
                    </div>

                    {csvFile && (
                      <div className="p-2.5 bg-slate-50 border border-indigo-200 rounded-md flex items-center justify-between text-xs text-indigo-800 font-semibold">
                        <span>{csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)</span>
                        <Button variant="ghost" size="sm" onClick={() => setCsvFile(null)} className="h-5 w-5 p-0 text-slate-500">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    <Button 
                      onClick={handleCsvUpload} 
                      disabled={uploadLoading || !csvFile}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-9 text-xs"
                    >
                      {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      <span>Upload & Process CSV</span>
                    </Button>
                  </div>
                )}

                {uploadTab === 'manual' && (
                  <form onSubmit={handleManualEntry} className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <Label htmlFor="mfg_part_num" className="text-slate-700">Model / Part # (MPN) *</Label>
                      <Input
                        id="mfg_part_num"
                        value={manualForm.mfg_part_num}
                        onChange={(e) => setManualForm(p => ({ ...p, mfg_part_num: e.target.value }))}
                        placeholder="e.g. PDSH4816AF"
                        required
                        className="bg-white border-slate-300 h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="part_desc" className="text-slate-700">Raw Description</Label>
                      <Input
                        id="part_desc"
                        value={manualForm.part_desc}
                        onChange={(e) => setManualForm(p => ({ ...p, part_desc: e.target.value }))}
                        placeholder="e.g. 7-1/4 INCH 24T CIRCULAR SAW BLADE"
                        className="bg-white border-slate-300 h-8"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="unilog_brand" className="text-slate-700">Supplier Brand Code</Label>
                        <Input
                          id="unilog_brand"
                          value={manualForm.unilog_brand}
                          onChange={(e) => setManualForm(p => ({ ...p, unilog_brand: e.target.value }))}
                          placeholder="e.g. FREUD INC (2435)"
                          className="bg-white border-slate-300 h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="part_manuf" className="text-slate-700">Supplier Manufacturer</Label>
                        <Input
                          id="part_manuf"
                          value={manualForm.part_manuf}
                          onChange={(e) => setManualForm(p => ({ ...p, part_manuf: e.target.value }))}
                          placeholder="e.g. FREUD TOOL CORP 99"
                          className="bg-white border-slate-300 h-8"
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit"
                      disabled={uploadLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-9 text-xs mt-1"
                    >
                      {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      <span>Save Product to Catalog</span>
                    </Button>
                  </form>
                )}

                {uploadTab === 'pdf' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-lg p-6 text-center cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => e.target.files?.[0] && setPdfFile(e.target.files[0])}
                        className="hidden"
                        id="pdf-file-input"
                        disabled={uploadLoading}
                      />
                      <label htmlFor="pdf-file-input" className="cursor-pointer space-y-1 block">
                        <FileText className="h-8 w-8 mx-auto text-indigo-600 mb-1" />
                        <p className="text-xs font-semibold text-slate-800">Click or drag PDF catalog sheet here</p>
                        <p className="text-[11px] text-slate-500">PDF text will be parsed into structured items</p>
                      </label>
                    </div>
                    {pdfFile && (
                      <div className="p-2.5 bg-slate-50 border border-indigo-200 rounded-md flex items-center justify-between text-xs text-indigo-800 font-semibold">
                        <span>{pdfFile.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => setPdfFile(null)} className="h-5 w-5 p-0 text-slate-500">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Button 
                      onClick={handlePdfUpload} 
                      disabled={uploadLoading || !pdfFile}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-9 text-xs"
                    >
                      {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      <span>Parse PDF Catalog Sheet</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
