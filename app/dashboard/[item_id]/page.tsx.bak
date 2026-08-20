'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { 
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, XCircle, AlertTriangle, MinusCircle, 
  Zap, ArrowLeft, ExternalLink, Copy, Info, 
  Package, Tag, Layers, FileText, Box, Settings,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchItemDetail, enrichItem, Item, EnrichedItem, ScoreItemResponse, GroupScore } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';

const MATCH_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  exact_match: CheckCircle,
  close_match: AlertTriangle,
  mismatch: XCircle,
  missing_in_output: MinusCircle,
  extra_in_output: Info,
};

const MATCH_LABELS: Record<string, string> = {
  exact_match: 'Match',
  close_match: 'Partial',
  mismatch: 'Mismatch',
  missing_in_output: 'Missing',
  extra_in_output: 'Extra',
};

const MATCH_COLORS: Record<string, string> = {
  exact_match: 'text-green-600 bg-green-50 border-green-200',
  close_match: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  mismatch: 'text-red-600 bg-red-50 border-red-200',
  missing_in_output: 'text-gray-600 bg-gray-50 border-gray-200',
  extra_in_output: 'text-blue-600 bg-blue-50 border-blue-200',
};

function MatchBadge({ matchType }: { matchType: string }) {
  const Icon = MATCH_ICONS[matchType] || MinusCircle;
  const label = MATCH_LABELS[matchType] || matchType;
  const colorClass = MATCH_COLORS[matchType] || '';
  
  return (
    <Badge variant="outline" className={cn('gap-1', colorClass)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function FieldRow({ label, value, emptyLabel = 'Not available' }: { label: string; value: string | number | null | undefined; emptyLabel?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b last:border-0">
      <span className="font-medium text-sm text-muted-foreground w-full sm:w-48">{label}</span>
      <span className={cn('text-sm', value === null || value === undefined || value === '' ? 'text-muted-foreground italic' : '')}>
        {value !== null && value !== undefined && value !== '' ? value : emptyLabel}
      </span>
    </div>
  );
}

function DescriptionCard({ fieldName, value, charCount, maxChars }: { fieldName: string; value: string | null; charCount: number; maxChars: number }) {
  const isOver = charCount > maxChars;
  return (
    <Card className={cn('mb-3', isOver && 'border-destructive')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium capitalize">{fieldName.replace('_', ' ')}</span>
          <Badge variant={isOver ? 'destructive' : 'secondary'} className="text-xs">
            {charCount}/{maxChars} chars
          </Badge>
        </div>
        <p className={cn('text-sm font-mono bg-muted p-3 rounded', value ? '' : 'text-muted-foreground italic')}>
          {value || 'Not generated'}
        </p>
      </CardContent>
    </Card>
  );
}

function ValidationView({ scoreResult }: { scoreResult: ScoreItemResponse }) {
  const { group_scores, overall_accuracy_pct, confidence_accuracy_correlation } = scoreResult;

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Validation Summary</span>
            <Badge variant={overall_accuracy_pct >= 80 ? 'success' : overall_accuracy_pct >= 50 ? 'warning' : 'destructive'}>
              {overall_accuracy_pct}% Overall
            </Badge>
          </CardTitle>
          <CardDescription>Field-by-field comparison against ground truth</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            {group_scores.map((group) => (
              <div key={group.group} className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{group.group}</p>
                <p className="text-2xl font-bold">{group.matched}/{group.total}</p>
                <Badge 
                  variant={group.accuracy_pct >= 80 ? 'success' : group.accuracy_pct >= 50 ? 'warning' : 'destructive'}
                  className="mt-1"
                >
                  {group.accuracy_pct}%
                </Badge>
                {group.reason_tag && (
                  <p className="text-xs text-muted-foreground mt-1">{group.reason_tag.replace('_', ' ')}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confidence-Accuracy Correlation */}
      {confidence_accuracy_correlation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Confidence-Accuracy Correlation
            </CardTitle>
            <CardDescription>
              {confidence_accuracy_correlation.correlation_note}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Confidence Score</p>
                <p className="text-2xl font-bold">{confidence_accuracy_correlation.confidence_score}%</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Field Confidence</p>
                <p className="text-2xl font-bold">{confidence_accuracy_correlation.field_confidence}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={confidence_accuracy_correlation.status === 'enriched' ? 'success' : 'warning'}>
                  {confidence_accuracy_correlation.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Group Details */}
      {group_scores.map((group) => (
        <Card key={group.group} className={group.accuracy_pct < 50 ? 'border-destructive/50' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="capitalize">{group.group}</span>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={group.accuracy_pct >= 80 ? 'success' : group.accuracy_pct >= 50 ? 'warning' : 'destructive'}
                >
                  {group.accuracy_pct}% ({group.matched}/{group.total})
                </Badge>
                {group.reason_tag && (
                  <Badge variant="outline" className="text-xs">
                    {group.reason_tag.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead className="w-32">Match</TableHead>
                    {group.fields[0]?.details && <TableHead>Details</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.fields.map((field, index) => (
                    <TableRow key={`${group.group}-${index}`}>
                      <TableCell className="font-mono text-sm">{field.field_name}</TableCell>
                      <TableCell className="max-w-md truncate font-mono text-sm">
                        {field.expected !== null && field.expected !== undefined ? String(field.expected) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-md truncate font-mono text-sm">
                        {field.actual !== null && field.actual !== undefined ? String(field.actual) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell><MatchBadge matchType={field.match_type} /></TableCell>
                      {group.fields[0]?.details && (
                        <TableCell className="text-xs text-muted-foreground">{field.details}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
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
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreItemResponse | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'enriched' | 'validation'>('enriched');
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
  const maxChars = {
    invoice_desc: 40,
    mobile_desc: 80,
    short_desc: 180,
    long_desc1: 500,
    marketing_description: 350,
  };

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
          </CardContent        </Card>

        {/* Enriched Output Section */}
        {hasEnrichment && (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="enriched">
                  <Layers className="h-4 w-4 mr-2" />
                  Enriched Output
                </TabsTrigger>
                <TabsTrigger value="validation">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Validation
                </TabsTrigger>
              </TabsList>

              <TabsContent value="enriched">
                <div className="space-y-6 pt-4">
                  {/* Identity */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Tag className="h-5 w-5" />
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

                  {/* Taxonomy */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" />
                        Taxonomy
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FieldRow label="Department" value={item.dept} />
                        <FieldRow label="Class" value={item.class} />
                        <FieldRow label="Fine" value={item.fine} />
                        <FieldRow label="Classpath" value={item.classpath} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Descriptions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Descriptions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {['invoice_desc', 'mobile_desc', 'short_desc', 'long_desc1', 'marketing_description'].map(fieldName => {
                          const desc = item.item_descriptions?.find(d => d.field_name === fieldName);
                          return (
                            <DescriptionCard
                              key={fieldName}
                              fieldName={fieldName}
                              value={desc?.value || null}
                              charCount={desc?.char_count || 0}
                              maxChars={maxChars[fieldName as keyof typeof maxChars] || 500}
                            />
                          );
                        })}
                        {item.item_descriptions?.length === 0 && (
                          <p className="text-muted-foreground text-sm italic">No descriptions generated</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Attributes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Attributes ({item.item_attributes?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {item.item_attributes && item.item_attributes.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Label</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>UOM</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {item.item_attributes.map((attr) => (
                                <TableRow key={attr.id}>
                                  <TableCell className="font-mono text-xs">{attr.seq}</TableCell>
                                  <TableCell className="font-medium">{attr.label}</TableCell>
                                  <TableCell>{attr.value}</TableCell>
                                  <TableCell className="text-muted-foreground">{attr.uom || '—'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm italic">No attributes extracted</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Specs */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Box className="h-5 w-5" />
                        Specifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {item.item_specs ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FieldRow label="UPC" value={item.item_specs.upc} />
                          <FieldRow label="EAN" value={item.item_specs.ean} />
                          <FieldRow label="GTIN" value={item.item_specs.gtin} />
                          <FieldRow label="UNSPSC" value={item.item_specs.unspsc} />
                          <FieldRow label="List Price" value={item.item_specs.list_price ? `$${item.item_specs.list_price}` : null} />
                          <FieldRow label="Length" value={item.item_specs.length ? `${item.item_specs.length} ${item.item_specs.length_uom || ''}` : null} />
                          <FieldRow label="Width" value={item.item_specs.width ? `${item.item_specs.width} ${item.item_specs.width_uom || ''}` : null} />
                          <FieldRow label="Height" value={item.item_specs.height ? `${item.item_specs.height} ${item.item_specs.height_uom || ''}` : null} />
                          <FieldRow label="Weight" value={item.item_specs.weight ? `${item.item_specs.weight} ${item.item_specs.weight_uom || ''}` : null} />
                          <FieldRow label="Country of Origin" value={item.item_specs.country_of_origin} />
                          <FieldRow label="Warranty" value={item.item_specs.warranty} />
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm italic">No specifications extracted</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="validation">
                <div className="pt-4">
                  {scoreResult ? (
                    <ValidationView scoreResult={scoreResult} />
                  ) : (
                    <Card className="text-center py-12">
                      <CardContent>
                        <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No validation data</h3>
                        <p className="text-muted-foreground mb-4">
                          Run scoring against ground truth to see field-by-field comparison.
                        </p>
                        <Button onClick={() => {}} disabled>
                          <Zap className="h-4 w-4 mr-2" />
                          Run Validation (via /api/score/batch)
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
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

        {/* Status info for enriched items */}
        {hasEnrichment && (
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Info</CardTitle>
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
        )}
      </main>
    </div>
  );
}