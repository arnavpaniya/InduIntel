'use client';

import { useState, useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { 
  ArrowLeft, Zap, Settings, Package, CheckCircle2, XCircle, AlertTriangle, 
  FileText, Download, Wand2, ChevronRight, Layers, Eye, Check, X, Shield, Sparkles, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchItemDetail, enrichItem } from '@/lib/api';
import { EnrichedItem, ItemDescription, ItemAttribute, ItemSpec } from '@/lib/types';

function NonTechFieldRow({ label, value, note }: { label: string; value: string | number | null | undefined; note?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-200 last:border-0 gap-1 text-xs">
      <div className="flex items-center gap-1.5 min-w-[180px]">
        <span className="font-semibold text-slate-700">{label}</span>
        {note && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900 text-slate-100 text-[11px]">
                {note}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className={cn('font-medium text-slate-900 sm:text-right', (!value && value !== 0) && 'text-slate-400 italic')}>
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
  const [activeTab, setActiveTab] = useState<'story' | 'transform' | 'technical' | 'audit'>('story');
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
        showToast(`Enrichment complete! Quality score: ${result.confidence_score}%`, 'success');
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
      <div className="app-shell min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading product report...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    notFound();
  }

  const isRaw = item.status === 'raw';
  const hasEnrichment = item.status !== 'raw';
  const mainSpec: ItemSpec | undefined = item.item_specs && item.item_specs.length > 0 ? item.item_specs[0] : undefined;
  
  let qualityGrade = 'Grade A+ (100% Ready)';
  let gradeBadgeVariant: 'success' | 'warning' | 'gray' = 'success';
  if (isRaw) {
    qualityGrade = 'Not Cleaned Yet';
    gradeBadgeVariant = 'gray';
  } else if (item.status === 'review' || (item.confidence_score && item.confidence_score < 60)) {
    qualityGrade = 'Grade C (Needs Quick Check)';
    gradeBadgeVariant = 'warning';
  } else if (item.confidence_score && item.confidence_score < 80) {
    qualityGrade = 'Grade B (Good Quality)';
    gradeBadgeVariant = 'success';
  }

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-700">MPN: {item.mfg_part_num}</span>
                <Badge variant={gradeBadgeVariant} className="text-[11px] font-semibold">
                  {qualityGrade}
                </Badge>
              </div>
              <h1 className="text-xs font-bold text-slate-900 truncate max-w-md">{item.part_desc || 'Industrial Product'}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isRaw && (
              <a 
                href={`/api/report/${item.id}`}
                download={`${item.mfg_part_num}-catalog-report.pdf`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Download PDF Report</span>
                <Download className="h-3 w-3 ml-0.5" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Notification Toast */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2">
            <Card className="w-80 shadow-lg border-slate-200 bg-white text-slate-900">
              <CardContent className="p-4 flex items-center gap-3">
                {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
                {toast.type === 'error' && <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
                <p className="text-xs font-semibold">{toast.message}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Product Summary Card */}
        <Card className="clean-card">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Product Title</span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">{item.part_desc || item.mfg_part_num}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-300 text-slate-700 text-xs">
                  Completeness: {item.confidence_score ? `${item.confidence_score}%` : '0%'}
                </Badge>
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-xs">
                  AI Confidence: {item.field_confidence ? `${Math.round(item.field_confidence * 100)}%` : '—'}
                </Badge>
              </div>
            </div>

            {/* Explanation Box */}
            <div className="p-4 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 leading-relaxed space-y-1">
                <p className="font-semibold text-slate-900">What is this product report?</p>
                <p>
                  This report shows how AI cleaned the raw supplier data for model <code className="font-mono text-indigo-700 font-bold">{item.mfg_part_num}</code>. 
                  {hasEnrichment 
                    ? ` AI cleaned the manufacturer name to "${item.manufacturer_name || 'Detected'}", inferred brand "${item.brand_name || 'Detected'}", categorized it under standard e-commerce groups, and created 5 ready-to-use customer descriptions.`
                    : ' This product has not been cleaned yet. Click "Run AI Cleaning" below to generate descriptions, categories, and technical specs.'}
                </p>
              </div>
            </div>

            {isRaw && (
              <div className="pt-2">
                <Button 
                  onClick={handleEnrich} 
                  disabled={enriching} 
                  className="w-full sm:w-auto h-10 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-2"
                >
                  <Zap className="h-4 w-4 fill-white" />
                  {enriching ? 'Cleaning Catalog Data...' : 'Run AI Cleaning Pipeline'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Multi-Tab Report Hub */}
        {hasEnrichment && (
          <div className="space-y-6">
            <div className="flex border-b border-slate-200 bg-white p-1 rounded-lg border">
              <button
                onClick={() => setActiveTab('story')}
                className={cn(
                  'flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'story'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>1. Product Story</span>
              </button>

              <button
                onClick={() => setActiveTab('transform')}
                className={cn(
                  'flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'transform'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Wand2 className="h-3.5 w-3.5" />
                <span>2. Before vs After Fixes</span>
              </button>

              <button
                onClick={() => setActiveTab('technical')}
                className={cn(
                  'flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'technical'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>3. Specs & Descriptions</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={cn(
                  'flex-1 py-2 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'audit'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                <span>4. AI Accuracy Audit</span>
              </button>
            </div>

            {/* Tab 1: Product Story */}
            {activeTab === 'story' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category Tree */}
                  <Card className="clean-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-indigo-600" />
                        Website Category Breadcrumb Tree
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">Navigation breadcrumbs for your store</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.classpath ? (
                        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-800 font-medium">
                          {item.classpath.split('>').map((cat, idx, arr) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                                {cat.trim()}
                              </span>
                              {idx < arr.length - 1 && (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No category tree generated.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Brand & Manufacturer */}
                  <Card className="clean-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Package className="h-4 w-4 text-emerald-600" />
                        Clean Brand Identity
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">Normalized manufacturer and brand details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <NonTechFieldRow label="Clean Manufacturer" value={item.manufacturer_name} note="Stripped distributor numbers & junk codes" />
                      <NonTechFieldRow label="Clean Brand Name" value={item.brand_name} note="Standardized public brand" />
                      <NonTechFieldRow label="Model / Part #" value={item.mfg_part_num} note="Unique manufacturer part number" />
                    </CardContent>
                  </Card>
                </div>

                {/* Descriptions */}
                {item.item_descriptions && item.item_descriptions.length > 0 && (
                  <Card className="clean-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        Ready Customer Descriptions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.item_descriptions.map((desc: ItemDescription) => (
                        <div key={desc.field_name} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                              {desc.field_name.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {desc.char_count} chars
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed font-sans">{desc.value}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Tab 2: Before vs After Transformation */}
            {activeTab === 'transform' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Before Box */}
                  <Card className="border-red-200 bg-red-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-bold text-red-900 flex items-center gap-2">
                        <X className="h-4 w-4 text-red-600" />
                        Before: Messy Raw Supplier Data
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <NonTechFieldRow label="Supplier Description" value={item.part_desc} />
                      <NonTechFieldRow label="E1 Feed Brand" value={item.e1_brand} />
                      <NonTechFieldRow label="Unilog Feed Brand" value={item.unilog_brand} />
                      <NonTechFieldRow label="DIB Feed Brand" value={item.dib_brand} />
                      <NonTechFieldRow label="Supplier Manufacturer" value={item.part_manuf} />
                    </CardContent>
                  </Card>

                  {/* After Box */}
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600" />
                        After: AI Clean Catalog Data
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <NonTechFieldRow label="Clean Manufacturer" value={item.manufacturer_name} />
                      <NonTechFieldRow label="Clean Brand Name" value={item.brand_name} />
                      <NonTechFieldRow label="Category Tree" value={item.classpath} />
                      <NonTechFieldRow label="Quality Status" value={item.status} />
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}

            {/* Tab 3: Full Spec Sheet & Descriptions */}
            {activeTab === 'technical' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {item.item_attributes && item.item_attributes.length > 0 ? (
                  <Card className="clean-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-indigo-600" />
                        Extracted Technical Specifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {item.item_attributes.map((attr: ItemAttribute, idx: number) => (
                          <div key={idx} className="p-2.5 bg-slate-50 rounded-md border border-slate-200">
                            <span className="text-[10px] text-slate-500 block font-semibold">{attr.label}</span>
                            <span className="text-xs font-bold text-slate-900">{attr.value} {attr.uom ? attr.uom : ''}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-xs text-slate-400 italic">No attributes extracted.</p>
                )}

                {mainSpec && (
                  <Card className="clean-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Package className="h-4 w-4 text-emerald-600" />
                        Universal Barcodes & Dimensions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <NonTechFieldRow label="UPC Barcode" value={mainSpec.upc} note="Universal Product Code (12 digits)" />
                      <NonTechFieldRow label="UNSPSC Code" value={mainSpec.unspsc} note="Global industry commodity classification code" />
                      <NonTechFieldRow label="List Price" value={mainSpec.list_price ? `$${mainSpec.list_price}` : null} />
                      <NonTechFieldRow label="Dimensions (L x W x H)" value={`${mainSpec.length || '—'} x ${mainSpec.width || '—'} x ${mainSpec.height || '—'} ${mainSpec.length_uom || ''}`} />
                      <NonTechFieldRow label="Weight" value={mainSpec.weight ? `${mainSpec.weight} ${mainSpec.weight_uom || 'lbs'}` : null} />
                      <NonTechFieldRow label="Country of Origin" value={mainSpec.country_of_origin} />
                      <NonTechFieldRow label="Warranty" value={mainSpec.warranty} />
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Tab 4: AI Accuracy Audit */}
            {activeTab === 'audit' && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <Card className="clean-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-600" />
                      AI Reliability & Self-Trust Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <span className="text-xs text-slate-500 font-semibold">Data Completeness Score</span>
                        <p className="text-2xl font-bold text-emerald-700">{item.confidence_score ? `${item.confidence_score}%` : '0%'}</p>
                        <p className="text-[11px] text-slate-500">Percentage of standard product catalog fields filled</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <span className="text-xs text-slate-500 font-semibold">AI Self-Trust Score</span>
                        <p className="text-2xl font-bold text-indigo-700">{item.field_confidence ? `${Math.round(item.field_confidence * 100)}%` : '—'}</p>
                        <p className="text-[11px] text-slate-500">Average self-reported confidence across 5 AI steps</p>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">5-Step AI Enrichment Execution Log</h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                          <span className="font-semibold text-slate-800">1. Manufacturer & Brand Cleansing</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                          <span className="font-semibold text-slate-800">2. Category Taxonomy Tree Generation</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                          <span className="font-semibold text-slate-800">3. Technical Attribute Extraction</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                          <span className="font-semibold text-slate-800">4. Customer Description Formats</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                          <span className="font-semibold text-slate-800">5. Specifications & Universal Codes</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
