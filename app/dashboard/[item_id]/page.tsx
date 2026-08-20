'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Zap, Settings, Package, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchItemDetail, enrichItem } from '@/lib/api';
import { Item, EnrichedItem } from '@/lib/types';
import { useRouter, useParams } from 'next/navigation';

function FieldRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b last:border-0">
      <span className="font-medium text-sm text-muted-foreground w-full sm:w-48">{label}</span>
      <span className={cn('text-sm', value === null || value === undefined || value === '' ? 'text-muted-foreground italic' : '')}>
        {value !== null && value !== undefined && value !== '' ? value : 'Not available'}
      </span>
    </div>
  );
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.item_id as string;
  
  const [item, setItem] = useState<EnrichedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    async function loadItem() {
      setLoading(true);
      try {
        const data = await fetchItemDetail(itemId);
        setItem(data);
      } catch (error) {
        console.error('Failed to load item:', error);
        notFound();
      } finally {
        setLoading(false);
      }
    }
    loadItem();
  }, [itemId]);

  const handleEnrich = async () => {
    if (!item) return;
    setEnriching(true);
    try {
      const result = await enrichItem(item.id);
      if (result.success) {
        showToast(`Enriched - ${result.status} (${result.confidence_score}% confidence)`, 'success');
        setItem(result.item);
      } else {
        showToast('Enrichment failed', 'error');
      }
    } catch (error) {
      console.error('Enrich failed:', error);
      showToast('Enrichment failed', 'error');
    } finally {
      setEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading item...</p>
      </div>
    );
  }

  if (!item) {
    notFound();
  }

  const isRaw = item.status === 'raw';
  const hasEnrichment = item.status !== 'raw';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-mono">{item.mfg_part_num}</h1>
              <p className="text-sm text-muted-foreground truncate max-w-md">{item.part_desc || 'No description'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant={['enriched'].includes(item.status) ? 'success' : item.status === 'review' ? 'warning' : item.status === 'enriching' ? 'info' : 'gray'}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Package className="h-3 w-3" />
              Confidence: {item.confidence_score ?? '—'}%
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Settings className="h-3 w-3" />
              Field Confidence: {item.field_confidence ?? '—'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 mb-4">
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

        {/* Raw Input Section - Always visible for raw items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Raw Input
            </CardTitle>
            <CardDescription>Original data from source CSV</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-3 text-sm text-muted-foreground">Identification</h4>
                <FieldRow label="MPN" value={item.mfg_part_num} />
                <FieldRow label="Part Description" value={item.part_desc} />
              </div>
              <div>
                <h4 className="font-medium mb-3 text-sm text-muted-foreground">Brand Fields (Source)</h4>
                <FieldRow label="E1 Brand" value={item.e1_brand} />
                <FieldRow label="Unilog Brand" value={item.unilog_brand} />
                <FieldRow label="DIB Brand" value={item.dib_brand} />
                <FieldRow label="Part Manufacturer" value={item.part_manuf} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enriched Output Section */}
        {hasEnrichment && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldRow label="Manufacturer" value={item.manufacturer_name} />
                  <FieldRow label="Brand" value={item.brand_name} />
                  <FieldRow label="MPN" value={item.mfg_part_num} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Pipeline Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Orchestrator Completeness</p>
                    <p className="font-medium text-lg">{item.confidence_score ?? '—'}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">LLM Self-Reported Confidence</p>
                    <p className="font-medium text-lg">{item.field_confidence ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{item.status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Raw item - show enrich button */}
        {isRaw && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Enrichment
              </CardTitle>
              <CardDescription>This item has not been enriched yet. Click below to run the enrichment pipeline.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleEnrich} disabled={enriching} className="w-full sm:w-auto" size="lg">
                <Zap className="h-5 w-5 mr-2" />
                {enriching ? 'Enriching...' : 'Run Enrichment Pipeline'}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}