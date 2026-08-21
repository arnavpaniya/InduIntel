'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, type Variants } from 'motion/react';
import { 
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption 
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
  Zap, AlertTriangle, CheckCircle, Clock, XCircle,
  BarChart2, Settings, Package, Layers, Eye,
  Upload, FileText, Plus, X, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchItems, enrichItem, enrichBatch, fetchQuotaStatus, uploadItems, addManualItem } from '@/lib/api';
import { Item, ItemsResponse } from '@/lib/types';
import { useRouter, useSearchParams } from 'next/navigation';

const STATUS_BADGE_VARIANTS: Record<Item['status'], 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'gray'> = {
  raw: 'gray',
  enriching: 'info',
  enriched: 'success',
  review: 'warning',
};

const STATUS_LABELS: Record<Item['status'], string> = {
  raw: 'Raw',
  enriching: 'Enriching',
  enriched: 'Enriched',
  review: 'Needs Review',
};

const STATUS_DESCRIPTIONS: Record<Item['status'], string> = {
  raw: 'Not yet processed',
  enriching: 'Currently being enriched',
  enriched: 'Successfully enriched',
  review: 'Low confidence, needs manual review',
};

const REQUIRED_COLUMNS = [
  'Mfg_Part_Num',
  'Part_Desc',
  'E1_Brand',
  'Unilog_Brand',
  'DIB_Brand',
  'Part_Manuf',
];

function StatusBadge({ status }: { status: Item['status'] }) {
  const variant = STATUS_BADGE_VARIANTS[status];
  const label = STATUS_LABELS[status];
  const description = STATUS_DESCRIPTIONS[status];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="capitalize cursor-help">{label}</Badge>
        </TooltipTrigger>
        <TooltipContent side="top">{description}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ConfidenceScore({ score }: { score: number | null }) {
  if (!score) return <span className="text-muted-foreground">—</span>;
  
  let variant: 'default' | 'success' | 'warning' | 'destructive' = 'default';
  if (score >= 80) variant = 'success';
  else if (score >= 60) variant = 'warning';
  else variant = 'destructive';
  
  return (
    <Badge variant={variant} className="text-xs">
      {score}%
    </Badge>
  );
}

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: 'easeOut' } },
};

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

function SummaryCard({ label, value, icon: Icon, tone }: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'neutral' | 'raw' | 'success' | 'review';
}) {
  return (
    <motion.div variants={panelVariants} layout>
      <Card className="metric-ring overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-sm text-muted-foreground">{label}</p>
              <p className={cn(
                'mt-1 text-2xl font-bold',
                tone === 'raw' && 'text-slate-600',
                tone === 'success' && 'text-emerald-700',
                tone === 'review' && 'text-amber-700'
              )}>{value}</p>
            </div>
            <div className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg shadow-inner',
              tone === 'neutral' && 'bg-primary/10 text-primary',
              tone === 'raw' && 'bg-slate-100 text-slate-600',
              tone === 'success' && 'bg-emerald-50 text-emerald-700',
              tone === 'review' && 'bg-amber-50 text-amber-700'
            )}>
              <Icon className="h-5 w-5" />
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
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'updated_at', direction: 'desc' });
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
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

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
      const err = error as Error & { status?: number; statusText?: string; body?: string; url?: string };
      console.error('Failed to load items:', {
        message: err.message,
        status: err.status,
        statusText: err.statusText,
        body: err.body,
        url: err.url,
      });
      const detail = err.status ? ` (status ${err.status})` : '';
      const bodyDetail = err.body ? ` - ${err.body.slice(0, 200)}` : '';
      showToast(`Failed to load items${detail}${bodyDetail}`, 'error');
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

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleEnrich = async (itemId: string) => {
    if (quotaStatus.near_limit) {
      showToast('Quota near limit, cannot enrich', 'error');
      return;
    }

    setEnrichingIds(prev => new Set(prev).add(itemId));
    try {
      const result = await enrichItem(itemId);
      if (result.success) {
        showToast(`Enriched ${result.item.mfg_part_num} - ${result.status}`, 'success');
        loadItems();
      } else {
        showToast(`Failed to enrich: ${result.item_id}`, 'error');
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
      showToast('Quota near limit, cannot run batch', 'error');
      return;
    }

    setBatchLoading(true);
    try {
      const result = await enrichBatch(3);
      if (result.success) {
        const { processed, enriched, needs_review, skipped_due_to_quota, avg_confidence } = result.summary;
        showToast(
          `Batch complete: ${processed} processed, ${enriched} enriched, ${needs_review} need review${skipped_due_to_quota > 0 ? `, ${skipped_due_to_quota} skipped (quota)` : ''}. Avg confidence: ${avg_confidence}%`,
          'success'
        );
        loadItems();
        loadQuota();
      } else {
        showToast('Batch enrichment failed', 'error');
      }
    } catch (error) {
      console.error('Batch enrich failed:', error);
      showToast('Batch enrichment failed', 'error');
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
      showToast(result.message, 'success');
      setLastBatchId(result.batchId);
      setUploadOpen(false);
      setCsvFile(null);
      // Filter to show only the newly uploaded batch
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
      setLastBatchId(result.batchId);
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
      showToast('Mfg Part Num is required', 'error');
      return;
    }
    setUploadLoading(true);
    try {
      const result = await addManualItem(manualForm);
      showToast(result.message, 'success');
      setLastBatchId(result.batchId);
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

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        showToast('Please select a CSV file', 'error');
        return;
      }
      setCsvFile(file);
    }
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
        showToast('Please select a PDF file', 'error');
        return;
      }
      setPdfFile(file);
    }
  };

  const getStatusCounts = () => {
    const counts = { raw: 0, enriching: 0, enriched: 0, review: 0 };
    items.forEach(item => counts[item.status]++);
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="app-shell min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-slate-950/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">InduIntel Dashboard</h1>
              <p className="text-sm text-muted-foreground">AI Product Intelligence Enrichment Pipeline</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-end gap-3">
            {/* Quota Status */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Zap className="h-4 w-4" />
                    <span>Quota: {quotaStatus.used}/{quotaStatus.limit}</span>
                    <AlertTriangle className={cn('h-4 w-4', quotaStatus.near_limit ? 'text-destructive' : 'text-muted-foreground')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="end">
                  <div className="space-y-1">
                    <p>Daily Gemini API quota</p>
                    <p className="font-medium">{quotaStatus.used} / {quotaStatus.limit} used</p>
                    <p className={cn('font-medium', quotaStatus.near_limit ? 'text-destructive' : 'text-emerald-700')}>
                      {quotaStatus.remaining} remaining
                    </p>
                    {quotaStatus.near_limit && (
                      <p className="text-destructive text-xs">Near limit - enrichment may be blocked</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Link href="/dashboard/insights" className="text-sm text-primary hover:underline flex items-center gap-1">
              <BarChart2 className="h-4 w-4" />
              Insights
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Summary */}
        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4"
        >
          <SummaryCard label="Total Items" value={pagination.total} icon={Package} tone="neutral" />
          <SummaryCard label="Raw Pending" value={statusCounts.raw} icon={Clock} tone="raw" />
          <SummaryCard label="Enriched" value={statusCounts.enriched} icon={CheckCircle} tone="success" />
          <SummaryCard label="Need Review" value={statusCounts.review} icon={AlertTriangle} tone="review" />
        </motion.div>

        {/* Empty State */}
        {pagination.total === 0 && (
          <Card className="glass-panel text-center py-12">
            <CardContent>
              <Package className="mx-auto mb-4 h-14 w-14 text-fuchsia-700/70" />
              <h2 className="text-xl font-semibold mb-2">No items found</h2>
              <p className="text-muted-foreground mb-4">Upload a CSV or add a product manually to get started.</p>
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Dataset
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Items Table */}
        {pagination.total > 0 && (
          <>
            {/* Toolbar */}
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="show"
              className="glass-panel mb-4 flex flex-col gap-4 rounded-lg p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by MPN, description, manufacturer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadItems()}
                    className="w-64 pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="raw">Raw</SelectItem>
                    <SelectItem value="enriching">Enriching</SelectItem>
                    <SelectItem value="enriched">Enriched</SelectItem>
                    <SelectItem value="review">Needs Review</SelectItem>
                  </SelectContent>
                </Select>
                {urlBatchId && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-fuchsia-50 text-fuchsia-700 rounded-lg text-sm">
                    <Filter className="h-4 w-4" />
                    <span>Filtered by batch: {urlBatchId.slice(0, 8)}...</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => router.push('/dashboard')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadItems}
                  disabled={loading}
                >
                  <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
                  Refresh
                </Button>
                <Button 
                  onClick={() => setUploadOpen(true)} 
                  disabled={uploadLoading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Dataset
                </Button>
                <Button 
                  onClick={handleBatchEnrich} 
                  disabled={batchLoading || quotaStatus.near_limit || statusCounts.raw === 0}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  {batchLoading ? 'Running...' : 'Run Batch (3)'}
                </Button>
              </div>
            </motion.div>

            {/* Table */}
            <motion.div variants={panelVariants} initial="hidden" animate="show">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('mfg_part_num')}>
                        MPN <Settings className="h-4 w-4 ml-1 opacity-50" />
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('part_desc')}>
                        Description <Settings className="h-4 w-4 ml-1 opacity-50" />
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('manufacturer_name')}>
                        Manufacturer <Settings className="h-4 w-4 ml-1 opacity-50" />
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                        Status <Settings className="h-4 w-4 ml-1 opacity-50" />
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('confidence_score')}>
                        Fields Filled <Settings className="h-4 w-4 ml-1 opacity-50" />
                      </TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No items match the current filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-accent/50">
                          <TableCell className="font-mono font-medium">{item.mfg_part_num}</TableCell>
                          <TableCell className="max-w-xs truncate">{item.part_desc || '—'}</TableCell>
                          <TableCell>{item.manufacturer_name || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell><StatusBadge status={item.status} /></TableCell>
                          <TableCell><ConfidenceScore score={item.confidence_score} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(item.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Link href={`/dashboard/${item.id}`}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              {item.status === 'raw' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEnrich(item.id)}
                                        disabled={enrichingIds.has(item.id) || quotaStatus.near_limit}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Zap className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      {enrichingIds.has(item.id) 
                                        ? 'Enriching...' 
                                        : quotaStatus.near_limit 
                                          ? 'Quota near limit' 
                                          : 'Enrich this item'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
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
                  <div className="flex items-center justify-between p-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                        disabled={pagination.page === 1 || loading}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                        disabled={pagination.page === pagination.totalPages || loading}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </motion.div>
          </>
        )}

        {/* Upload Modal */}
        {uploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in">
            <div className="bg-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-lg border shadow-xl shadow-slate-950/20 animate-in zoom-in-95 slide-in-from-bottom-4">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Upload Dataset</h2>
                <Button variant="ghost" size="sm" onClick={() => setUploadOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex border-b">
                <Button 
                  variant={uploadTab === 'csv' ? 'default' : 'ghost'} 
                  className="flex-1 py-3"
                  onClick={() => setUploadTab('csv')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  CSV Upload
                </Button>
                <Button 
                  variant={uploadTab === 'manual' ? 'default' : 'ghost'} 
                  className="flex-1 py-3"
                  onClick={() => setUploadTab('manual')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manual Entry
                </Button>
                <Button 
                  variant={uploadTab === 'pdf' ? 'default' : 'ghost'} 
                  className="flex-1 py-3"
                  onClick={() => setUploadTab('pdf')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF Upload
                </Button>
              </div>

              <div className="p-4">
                {uploadTab === 'csv' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/30 rounded-lg p-8 text-center">
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleCsvFileChange}
                        className="hidden"
                        id="csv-upload"
                        disabled={uploadLoading}
                      />
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        <FileText className="h-12 w-12 mx-auto text-fuchsia-700/70 mb-3" />
                        <p className="text-lg font-medium mb-1">Drag & drop CSV file or click to browse</p>
                        <p className="text-sm text-muted-foreground">Must contain: Mfg_Part_Num, Part_Desc, E1_Brand, Unilog_Brand, DIB_Brand, Part_Manuf</p>
                      </label>
                    </div>
                    {csvFile && (
                      <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-fuchsia-700" />
                          <div>
                            <p className="font-medium">{csvFile.name}</p>
                            <p className="text-sm text-muted-foreground">{(csvFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setCsvFile(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-2">Expected columns:</p>
                      <code className="bg-muted px-2 py-1 rounded">{REQUIRED_COLUMNS.join(', ')}</code>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handleCsvUpload} 
                      disabled={uploadLoading || !csvFile}
                    >
                      {uploadLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Uploading...
                        </>
                      ) : (
                        'Upload CSV'
                      )}
                    </Button>
                  </div>
                )}

                {uploadTab === 'manual' && (
                  <form onSubmit={handleManualEntry} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="mfg_part_num">Mfg Part Num *</Label>
                        <Input
                          id="mfg_part_num"
                          value={manualForm.mfg_part_num}
                          onChange={(e) => setManualForm(prev => ({ ...prev, mfg_part_num: e.target.value }))}
                          placeholder="e.g. PDSH4816AF"
                          required
                          disabled={uploadLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="part_desc">Part Description</Label>
                        <Input
                          id="part_desc"
                          value={manualForm.part_desc}
                          onChange={(e) => setManualForm(prev => ({ ...prev, part_desc: e.target.value }))}
                          placeholder="Product description"
                          disabled={uploadLoading}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="e1_brand">E1 Brand</Label>
                        <Input
                          id="e1_brand"
                          value={manualForm.e1_brand}
                          onChange={(e) => setManualForm(prev => ({ ...prev, e1_brand: e.target.value }))}
                          disabled={uploadLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="unilog_brand">Unilog Brand</Label>
                        <Input
                          id="unilog_brand"
                          value={manualForm.unilog_brand}
                          onChange={(e) => setManualForm(prev => ({ ...prev, unilog_brand: e.target.value }))}
                          disabled={uploadLoading}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dib_brand">DIB Brand</Label>
                        <Input
                          id="dib_brand"
                          value={manualForm.dib_brand}
                          onChange={(e) => setManualForm(prev => ({ ...prev, dib_brand: e.target.value }))}
                          disabled={uploadLoading}
                        />
                      </div>
                      <div>
                        <Label htmlFor="part_manuf">Part Manufacturer</Label>
                        <Input
                          id="part_manuf"
                          value={manualForm.part_manuf}
                          onChange={(e) => setManualForm(prev => ({ ...prev, part_manuf: e.target.value }))}
                          disabled={uploadLoading}
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={uploadLoading}
                    >
                      {uploadLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Adding...
                        </>
                      ) : (
                        'Add Product'
                      )}
                    </Button>
                  </form>
                )}

                {uploadTab === 'pdf' && (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-fuchsia-200 bg-fuchsia-50/30 rounded-lg p-8 text-center">
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handlePdfFileChange}
                        className="hidden"
                        id="pdf-upload"
                        disabled={uploadLoading}
                      />
                      <label htmlFor="pdf-upload" className="cursor-pointer">
                        <FileText className="h-12 w-12 mx-auto text-fuchsia-700/70 mb-3" />
                        <p className="text-lg font-medium mb-1">Drag & drop PDF file or click to browse</p>
                        <p className="text-sm text-muted-foreground">PDF should contain structured product data with MPN, description, brands, manufacturer</p>
                      </label>
                    </div>
                    {pdfFile && (
                      <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-fuchsia-700" />
                          <div>
                            <p className="font-medium">{pdfFile.name}</p>
                            <p className="text-sm text-muted-foreground">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setPdfFile(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground">
                      <p>PDF parsing extracts: Mfg Part Num, Part Desc, E1 Brand, Unilog Brand, DIB Brand, Part Manuf</p>
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={handlePdfUpload} 
                      disabled={uploadLoading || !pdfFile}
                    >
                      {uploadLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing PDF...
                        </>
                      ) : (
                        'Upload PDF'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
            <Card className={cn('w-80', toast.type === 'error' && 'border-destructive')}>
              <CardContent className="p-4 flex items-center gap-3">
                {toast.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-700" />}
                {toast.type === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                {toast.type === 'info' && <AlertTriangle className="h-5 w-5 text-amber-700" />}
                <p className="text-sm">{toast.message}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
