'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { 
  RefreshCw, Search, Filter, ChevronLeft, ChevronRight, 
  Zap, AlertTriangle, CheckCircle, Clock, XCircle,
  BarChart2, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchItems, enrichItem, enrichBatch, fetchQuotaStatus, Item, ItemsResponse } from '@/lib/api';
import { useRouter } from 'next/navigation';

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
  if (score === null) return <span className="text-muted-foreground">—</span>;
  
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

export default function DashboardPage() {
  const router = useRouter();
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
      });
      setItems(data.items);
      setPagination(prev => ({ ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages }));
    } catch (error) {
      console.error('Failed to load items:', error);
      showToast('Failed to load items', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, searchQuery, showToast]);

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

  const getStatusCounts = () => {
    const counts = { raw: 0, enriching: 0, enriched: 0, review: 0 };
    items.forEach(item => counts[item.status]++);
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">InduIntel Dashboard</h1>
              <p className="text-sm text-muted-foreground">AI Product Intelligence Enrichment Pipeline</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
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
                    <p className={cn('font-medium', quotaStatus.near_limit ? 'text-destructive' : 'text-green-600')}>
                      {quotaStatus.remaining} remaining
                    </p>
                    {quotaStatus.near_limit && (
                      <p className="text-destructive text-xs">⚠ Near limit - enrichment may be blocked</p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold">{pagination.total}</p>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">📦</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Raw (Pending)</p>
                  <p className="text-2xl font-bold text-gray-600">{statusCounts.raw}</p>
                </div>
                <div className="p-2 bg-gray-100 rounded-lg">⏳</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Enriched</p>
                  <p className="text-2xl font-bold text-green-600">{statusCounts.enriched}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">✅</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Need Review</p>
                  <p className="text-2xl font-bold text-yellow-600">{statusCounts.review}</p>
                </div>
                <div className="p-2 bg-yellow-100 rounded-lg">⚠️</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Empty State */}
        {pagination.total === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-6xl mb-4">📦</div>
              <h2 className="text-xl font-semibold mb-2">No items found</h2>
              <p className="text-muted-foreground mb-4">Run the seed script to populate the database with sample data.</p>
              <Button onClick={() => window.location.reload()}>Refresh</Button>
            </CardContent>
          </Card>
        )}

        {/* Items Table */}
        {pagination.total > 0 && (
          <>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
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
                  onClick={handleBatchEnrich} 
                  disabled={batchLoading || quotaStatus.near_limit || statusCounts.raw === 0}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  {batchLoading ? 'Running...' : 'Run Batch (3)'}
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card>
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
                        Confidence <Settings className="h-4 w-4 ml-1 opacity-50" />
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
                        <TableRow key={item.id} className="hover:bg-muted/50">
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
                                  <Settings className="h-4 w-4" />
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
          </>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
            <Card className={cn('w-80', toast.type === 'error' && 'border-destructive')}>
              <CardContent className="p-4 flex items-center gap-3">
                {toast.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                {toast.type === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                {toast.type === 'info' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                <p className="text-sm">{toast.message}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}