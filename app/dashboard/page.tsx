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
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, Search, Filter, ChevronLeft, ChevronRight, 
  Zap, AlertTriangle, CheckCircle2, Clock, XCircle,
  BarChart2, Settings, Package, Layers, Eye,
  Upload, FileText, Plus, X, Loader2, Sparkles, HelpCircle,
  Wand2, ArrowRight, ShieldCheck, FileSpreadsheet, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchItems, enrichItem, enrichBatch, fetchQuotaStatus, uploadItems, addManualItem } from '@/lib/api';
import { Item } from '@/lib/types';
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
    label: '100% Ready to Sell',
    sublabel: 'High confidence, complete catalog record',
    icon: CheckCircle2,
  },
  review: {
    variant: 'warning',
    label: 'Needs Quick Check',
    sublabel: 'Sparse supplier data — review recommended',
    icon: AlertTriangle,
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
        <TooltipContent side="top" className="max-w-xs text-xs bg-slate-900 text-slate-100 border-slate-800">
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
  
  let colorClass = 'bg-emerald-500';
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
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
      <Card className="glass-panel overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{label}</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-xs bg-slate-900 text-slate-100">
                      {description}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className={cn(
                'mt-1 text-2xl sm:text-3xl font-extrabold font-display tracking-tight',
                tone === 'raw' && 'text-slate-700 dark:text-slate-300',
                tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
                tone === 'review' && 'text-amber-600 dark:text-amber-400',
                tone === 'neutral' && 'text-indigo-600 dark:text-indigo-400'
              )}>{value}</p>
            </div>
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner',
              tone === 'neutral' && 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
              tone === 'raw' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
              tone === 'success' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
              tone === 'review' && 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
            )}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 truncate">{description}</p>
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
  const [quotaStatus, setQuotaStatus] = useState<{ used: number; limit: number; remaining: number; near_limit: boolean }>({ used: 0, limit: 18, remaining: 18, near_limit: false });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
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
    } catch (error) {
      const err = error as Error & { status?: number; statusText?: string; body?: string };
      console.error('Failed to load items:', err);
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
        showToast(`Failed to clean item`, 'error');
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

  const getStatusCounts = () => {
    const counts = { raw: 0, enriching: 0, enriched: 0, review: 0 };
    items.forEach(item => counts[item.status]++);
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="app-shell min-h-screen bg-slate-950 text-slate-100">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
                <Zap className="h-5 w-5 fill-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white font-display">InduIntel</span>
            </Link>
            <span className="text-slate-700 dark:text-slate-700">|</span>
            <h1 className="text-sm font-semibold text-slate-300">Product Catalog Workspace</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* AI Credits Meter */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-900/80 text-xs text-slate-300 cursor-help">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <span>Free AI Credits: <strong>{quotaStatus.remaining}</strong> left today</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end" className="bg-slate-900 text-slate-100 border-slate-800 text-xs">
                  <p className="font-semibold">Daily AI Pipeline Quota</p>
                  <p>{quotaStatus.used} of {quotaStatus.limit} AI calls used today.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Link href="/dashboard/insights">
              <Button variant="outline" size="sm" className="h-9 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white gap-1.5 text-xs">
                <BarChart2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>View Insights & Accuracy</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Notification Toast */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2">
            <Card className={cn('w-80 shadow-2xl border-slate-800 bg-slate-900 text-slate-100', toast.type === 'error' && 'border-red-500/50 bg-red-950/90 text-red-100')}>
              <CardContent className="p-4 flex items-center gap-3">
                {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
                {toast.type === 'error' && <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
                {toast.type === 'info' && <Zap className="h-5 w-5 text-indigo-400 shrink-0" />}
                <p className="text-xs sm:text-sm font-medium leading-snug">{toast.message}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Executive Catalog Overview Bar */}
        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
        >
          <ExecutiveCard 
            label="Total Catalog Items" 
            value={pagination.total} 
            description="Total product records currently loaded"
            icon={Package} 
            tone="neutral" 
          />
          <ExecutiveCard 
            label="100% Ready to Sell" 
            value={statusCounts.enriched} 
            description="Cleaned, categorized, & validated by AI"
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
            description="Raw supplier feed waiting for AI run"
            icon={Clock} 
            tone="raw" 
          />
        </motion.div>

        {/* Filter & Action Toolbar */}
        <motion.div
          variants={panelVariants}
          initial="hidden"
          animate="show"
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search part #, title, brand, or manufacturer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadItems()}
                className="pl-10 h-10 bg-slate-950 border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
              />
            </div>

            {/* Status Dropdown Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 h-10 bg-slate-950 border-slate-800 text-xs font-medium text-slate-200">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="enriched">🟢 Ready to Sell (100%)</SelectItem>
                <SelectItem value="review">🟡 Needs Quick Check</SelectItem>
                <SelectItem value="raw">⚪ Not Cleaned Yet</SelectItem>
              </SelectContent>
            </Select>

            {/* Batch Filter Badge */}
            {urlBatchId && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs border border-indigo-500/30 font-medium">
                <Filter className="h-3.5 w-3.5" />
                <span>Batch: {urlBatchId.slice(0, 8)}...</span>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-indigo-500/30" onClick={() => router.push('/dashboard')}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadItems}
              disabled={loading}
              className="h-10 border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <RefreshCw className={cn('h-4 w-4 mr-1.5 text-slate-400', loading && 'animate-spin')} />
              <span>Refresh</span>
            </Button>

            <Button 
              onClick={() => setUploadOpen(true)}
              className="h-10 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 gap-1.5 text-xs font-semibold"
            >
              <Upload className="h-4 w-4 text-indigo-400" />
              <span>Upload Catalog (CSV/PDF)</span>
            </Button>

            <Button 
              onClick={handleBatchEnrich} 
              disabled={batchLoading || quotaStatus.near_limit || statusCounts.raw === 0}
              className="h-10 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:opacity-95 text-white shadow-md shadow-indigo-500/20 font-semibold text-xs gap-1.5"
            >
              <Zap className="h-4 w-4 fill-white" />
              <span>{batchLoading ? 'Cleaning Catalog...' : 'Clean Next 3 Products'}</span>
            </Button>
          </div>
        </motion.div>

        {/* Product Catalog Table */}
        <motion.div variants={panelVariants} initial="hidden" animate="show">
          <Card className="border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-950/80 border-b border-slate-800">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400 text-xs font-semibold">Model / Part #</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Product Description</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Manufacturer & Brand</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Catalog Status</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Data Completeness</TableHead>
                    <TableHead className="text-right text-slate-400 text-xs font-semibold w-36">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-400 mb-2" />
                        <p className="text-xs text-slate-400 font-medium">Loading catalog items...</p>
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                        <Package className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                        <p className="text-sm font-semibold text-slate-300">No products match your current search</p>
                        <p className="text-xs text-slate-500 mt-1">Try resetting your search query or uploading new items.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id} className="border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                        {/* MPN */}
                        <TableCell className="font-mono text-xs font-semibold text-indigo-300">
                          {item.mfg_part_num}
                        </TableCell>

                        {/* Description */}
                        <TableCell className="max-w-xs sm:max-w-sm">
                          <p className="text-xs font-medium text-slate-200 truncate">{item.part_desc || 'No raw description provided'}</p>
                          {item.classpath && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                              🌲 {item.classpath}
                            </p>
                          )}
                        </TableCell>

                        {/* Manufacturer & Brand */}
                        <TableCell>
                          {item.manufacturer_name ? (
                            <div className="space-y-0.5">
                              <span className="text-xs font-semibold text-slate-200 block">{item.manufacturer_name}</span>
                              {item.brand_name && (
                                <span className="text-[11px] text-indigo-400 block">Brand: {item.brand_name}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 italic">Not cleaned yet</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <NonTechStatusBadge status={item.status} />
                        </TableCell>

                        {/* Completeness Bar */}
                        <TableCell>
                          <CompletenessBar score={item.confidence_score} />
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/dashboard/${item.id}`}>
                              <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs border-slate-700 bg-slate-950 text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-500 transition-all gap-1">
                                <Eye className="h-3.5 w-3.5" />
                                <span>Story & Report</span>
                              </Button>
                            </Link>

                            {item.status === 'raw' && (
                              <Button
                                size="sm"
                                onClick={() => handleEnrich(item.id)}
                                disabled={enrichingIds.has(item.id) || quotaStatus.near_limit}
                                className="h-8 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-1"
                              >
                                {enrichingIds.has(item.id) ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Zap className="h-3.5 w-3.5 fill-white" />
                                )}
                                <span>Clean</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/60">
                  <span className="text-xs text-slate-400">
                    Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total items)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                      disabled={pagination.page === 1 || loading}
                      className="h-8 w-8 p-0 border-slate-800 bg-slate-900 text-slate-300"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="h-8 w-8 p-0 border-slate-800 bg-slate-900 text-slate-300"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upload Dataset Modal */}
        {uploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white font-display">Upload Products</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setUploadOpen(false)} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Upload Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-950">
                <button 
                  className={cn('flex-1 py-3 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5', uploadTab === 'csv' ? 'border-indigo-500 text-indigo-400 bg-slate-900/60' : 'border-transparent text-slate-400 hover:text-slate-200')}
                  onClick={() => setUploadTab('csv')}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV File Upload
                </button>
                <button 
                  className={cn('flex-1 py-3 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5', uploadTab === 'manual' ? 'border-indigo-500 text-indigo-400 bg-slate-900/60' : 'border-transparent text-slate-400 hover:text-slate-200')}
                  onClick={() => setUploadTab('manual')}
                >
                  <Plus className="h-4 w-4" />
                  Single Product Form
                </button>
                <button 
                  className={cn('flex-1 py-3 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5', uploadTab === 'pdf' ? 'border-indigo-500 text-indigo-400 bg-slate-900/60' : 'border-transparent text-slate-400 hover:text-slate-200')}
                  onClick={() => setUploadTab('pdf')}
                >
                  <FileText className="h-4 w-4" />
                  PDF Spec Sheet
                </button>
              </div>

              <div className="p-6">
                {uploadTab === 'csv' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-700 bg-slate-950/60 hover:border-indigo-500/60 transition-colors rounded-xl p-8 text-center cursor-pointer">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => e.target.files?.[0] && setCsvFile(e.target.files[0])}
                        className="hidden"
                        id="csv-file-input"
                        disabled={uploadLoading}
                      />
                      <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                        <FileSpreadsheet className="h-10 w-10 mx-auto text-indigo-400 mb-2" />
                        <p className="text-sm font-semibold text-white">Click or drag CSV file here</p>
                        <p className="text-xs text-slate-400">Supported columns: Mfg_Part_Num, Part_Desc, E1_Brand, Unilog_Brand, DIB_Brand, Part_Manuf</p>
                      </label>
                    </div>

                    {csvFile && (
                      <div className="p-3 bg-slate-950 border border-indigo-500/40 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-indigo-300">
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>{csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setCsvFile(null)} className="h-6 w-6 p-0 text-slate-400">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    <Button 
                      onClick={handleCsvUpload} 
                      disabled={uploadLoading || !csvFile}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-10 text-xs"
                    >
                      {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      <span>Upload & Process CSV</span>
                    </Button>
                  </div>
                )}

                {uploadTab === 'manual' && (
                  <form onSubmit={handleManualEntry} className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <Label htmlFor="mfg_part_num" className="text-slate-300">Model / Part # (MPN) *</Label>
                      <Input
                        id="mfg_part_num"
                        value={manualForm.mfg_part_num}
                        onChange={(e) => setManualForm(p => ({ ...p, mfg_part_num: e.target.value }))}
                        placeholder="e.g. PDSH4816AF"
                        required
                        className="bg-slate-950 border-slate-800 text-slate-100 h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="part_desc" className="text-slate-300">Raw Description</Label>
                      <Input
                        id="part_desc"
                        value={manualForm.part_desc}
                        onChange={(e) => setManualForm(p => ({ ...p, part_desc: e.target.value }))}
                        placeholder="e.g. 7-1/4 INCH 24T CIRCULAR SAW BLADE"
                        className="bg-slate-950 border-slate-800 text-slate-100 h-9"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="unilog_brand" className="text-slate-300">Supplier Brand Code</Label>
                        <Input
                          id="unilog_brand"
                          value={manualForm.unilog_brand}
                          onChange={(e) => setManualForm(p => ({ ...p, unilog_brand: e.target.value }))}
                          placeholder="e.g. FREUD INC (2435)"
                          className="bg-slate-950 border-slate-800 text-slate-100 h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="part_manuf" className="text-slate-300">Supplier Manufacturer</Label>
                        <Input
                          id="part_manuf"
                          value={manualForm.part_manuf}
                          onChange={(e) => setManualForm(p => ({ ...p, part_manuf: e.target.value }))}
                          placeholder="e.g. FREUD TOOL CORP 99"
                          className="bg-slate-950 border-slate-800 text-slate-100 h-9"
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit"
                      disabled={uploadLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-10 text-xs mt-2"
                    >
                      {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      <span>Save Product to Catalog</span>
                    </Button>
                  </form>
                )}

                {uploadTab === 'pdf' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-slate-700 bg-slate-950/60 rounded-xl p-8 text-center cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => e.target.files?.[0] && setPdfFile(e.target.files[0])}
                        className="hidden"
                        id="pdf-file-input"
                        disabled={uploadLoading}
                      />
                      <label htmlFor="pdf-file-input" className="cursor-pointer space-y-2 block">
                        <FileText className="h-10 w-10 mx-auto text-indigo-400 mb-2" />
                        <p className="text-sm font-semibold text-white">Click or drag PDF catalog sheet here</p>
                        <p className="text-xs text-slate-400">PDF text will be parsed into structured items</p>
                      </label>
                    </div>
                    {pdfFile && (
                      <div className="p-3 bg-slate-950 border border-indigo-500/40 rounded-lg flex items-center justify-between text-xs text-indigo-300 font-medium">
                        <span>{pdfFile.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => setPdfFile(null)} className="h-6 w-6 p-0 text-slate-400">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <Button 
                      onClick={handlePdfUpload} 
                      disabled={uploadLoading || !pdfFile}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-10 text-xs"
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
