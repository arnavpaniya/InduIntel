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
  FileText, Download, Wand2, ChevronRight, Layers, Eye, Check, X, Shield, Sparkles, HelpCircle, RefreshCw, BarChart2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchItemDetail, enrichItem } from '@/lib/api';
import { EnrichedItem, ItemDescription, ItemAttribute, ItemSpec } from '@/lib/types';

function NonTechFieldRow({ label, value, note }: { label: string; value: string | number | null | undefined; note?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-slate-800/80 last:border-0 gap-1 text-xs">
      <div className="flex items-center gap-1.5 min-w-[180px]">
        <span className="font-semibold text-slate-300">{label}</span>
        {note && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-slate-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900 text-slate-100 border-slate-800 text-[11px]">
                {note}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className={cn('font-medium text-slate-100 sm:text-right', (!value && value !== 0) && 'text-slate-500 italic')}>
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
      <div className="app-shell min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Loading product report...</p>
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
  
  // Calculate quality grade in plain English
  let qualityGrade = 'Grade A+ (100% Ready to Sell)';
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
    <div className="app-shell min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-400">MPN: {item.mfg_part_num}</span>
                <Badge variant={gradeBadgeVariant} className="text-[11px] font-semibold">
                  {qualityGrade}
                </Badge>
              </div>
              <h1 className="text-sm font-bold text-slate-100 truncate max-w-md">{item.part_desc || 'Industrial Product'}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isRaw && (
              <a 
                href={`/api/report/${item.id}`}
                download={`${item.mfg_part_num}-catalog-report.pdf`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all"
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
            <Card className="w-80 shadow-2xl border-slate-800 bg-slate-900 text-slate-100">
              <CardContent className="p-4 flex items-center gap-3">
                {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
                {toast.type === 'error' && <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
                <p className="text-xs font-semibold">{toast.message}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Product Overview Summary Card */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">Product Title</span>
                <h2 className="text-xl sm:text-2xl font-bold text-white font-display leading-snug">{item.part_desc || item.mfg_part_num}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-700 text-slate-300 text-xs">
                  Completeness: {item.confidence_score ? `${item.confidence_score}%` : '0%'}
                </Badge>
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 text-xs">
                  AI Self-Trust: {item.field_confidence ? `${Math.round(item.field_confidence * 100)}%` : '—'}
                </Badge>
              </div>
            </div>

            {/* Conversational Explanation */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-1">
                <p className="font-semibold text-white">What is this product report?</p>
                <p>
                  This report shows how AI cleaned the raw supplier data for model <code className="font-mono text-indigo-300">{item.mfg_part_num}</code>. 
                  {hasEnrichment 
                    ? ` AI cleaned the manufacturer name to "${item.manufacturer_name || 'Detected'}", inferred brand "${item.brand_name || 'Detected'}", categorized it under standard e-commerce groups, and created 5 ready-to-use customer descriptions.`
                    : ' This product has not been cleaned yet. Click "Run AI Cleaning" below to generate descriptions, categories, and technical specs.'}
                </p>
              </div>
            </div>

            {/* Raw item - show trigger button */}
            {isRaw && (
              <div className="pt-2">
                <Button 
                  onClick={handleEnrich} 
                  disabled={enriching} 
                  className="w-full sm:w-auto h-11 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg text-xs gap-2"
                >
                  <Zap className="h-4 w-4 fill-white" />
                  {enriching ? 'Cleaning Catalog Data...' : 'Run AI Cleaning Pipeline'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tab Navigation Hub */}
        {hasEnrichment && (
          <div className="space-y-6">
            <div className="flex border-b border-slate-800 bg-slate-900/60 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('story')}
                className={cn(
                  'flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2',
                  activeTab === 'story'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Sparkles className="h-4 w-4" />
                <span>1. Easy Product Story</span>
              </button>

              <button
                onClick={() => setActiveTab('transform')}
                className={cn(
                  'flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2',
                  activeTab === 'transform'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Wand2 className="h-4 w-4" />
                <span>2. Before vs After Fixes</span>
              </button>

              <button
                onClick={() => setActiveTab('technical')}
                className={cn(
                  'flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2',
                  activeTab === 'technical'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <FileText className="h-4 w-4" />
                <span>3. Full Spec Sheet & Descriptions</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={cn(
                  'flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2',
                  activeTab === 'audit'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <Shield className="h-4 w-4" />
                <span>4. AI Accuracy Audit</span>
              </button>
            </div>

            {/* Tab 1: Product Story & Simple View */}
            {activeTab === 'story' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category Tree */}
                  <Card className="border-slate-800 bg-slate-900/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Layers className="h-4 w-4 text-indigo-400" />
                        Website Category Breadcrumb Tree
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400">Where this product belongs on your website</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.classpath ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 font-medium">
                          {item.classpath.split('>').map((cat, idx, arr) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-lg border border-indigo-500/30">
                                {cat.trim()}
                              </span>
                              {idx < arr.length - 1 && (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No category tree generated.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Brand & Manufacturer */}
                  <Card className="border-slate-800 bg-slate-900/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Package className="h-4 w-4 text-emerald-400" />
                        Clean Brand Identity
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400">Normalized manufacturer and brand details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <NonTechFieldRow label="Clean Manufacturer" value={item.manufacturer_name} note="Stripped distributor numbers & junk codes" />
                      <NonTechFieldRow label="Clean Brand Name" value={item.brand_name} note="Standardized public brand" />
                      <NonTechFieldRow label="Model / Part #" value={item.mfg_part_num} note="Unique manufacturer part number" />
                    </CardContent>
                  </Card>
                </div>

                {/* Ready Customer Descriptions */}
                {item.item_descriptions && item.item_descriptions.length > 0 && (
                  <Card className="border-slate-800 bg-slate-900/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-400" />
                        Ready Customer Descriptions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {item.item_descriptions.map((desc: ItemDescription) => (
                        <div key={desc.field_name} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                              {desc.field_name.replace('_', ' ')}
                            </span>
                            <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                              {desc.char_count} chars
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed font-sans">{desc.value}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Tab 2: Before vs After Transformation */}
            {activeTab === 'transform' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Before Box */}
                  <Card className="border-red-900/50 bg-red-950/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-red-300 flex items-center gap-2">
                        <X className="h-4 w-4 text-red-400" />
                        Before: Messy Raw Supplier Data
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <NonTechFieldRow label="Supplier Description" value={item.part_desc} />
                      <NonTechFieldRow label="E1 Feed Brand" value={item.e1_brand} />
                      <NonTechFieldRow label="Unilog Feed Brand" value={item.unilog_brand} />
                      <NonTechFieldRow label="DIB Feed Brand" value={item.dib_brand} />
                      <NonTechFieldRow label="Supplier Manufacturer" value={item.part_manuf} />
                    </CardContent>
                  </Card>

                  {/* After Box */}
                  <Card className="border-emerald-900/50 bg-emerald-950/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        After: AI Clean Catalog Data
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
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
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Attributes Table */}
                {item.item_attributes && item.item_attributes.length > 0 ? (
                  <Card className="border-slate-800 bg-slate-900/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Settings className="h-4 w-4 text-indigo-400" />
                        Extracted Technical Specifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {item.item_attributes.map((attr: ItemAttribute, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                            <span className="text-[11px] text-slate-400 block font-medium">{attr.label}</span>
                            <span className="text-xs font-bold text-slate-100">{attr.value} {attr.uom ? attr.uom : ''}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <p className="text-xs text-slate-500 italic">No attributes extracted.</p>
                )}

                {/* Specifications & Barcodes */}
                {mainSpec && (
                  <Card className="border-slate-800 bg-slate-900/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                        <Package className="h-4 w-4 text-emerald-400" />
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
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <Card className="border-slate-800 bg-slate-900/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-400" />
                      AI Reliability & Self-Trust Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-xs text-slate-400 font-medium">Data Completeness Score</span>
                        <p className="text-2xl font-bold text-emerald-400">{item.confidence_score ? `${item.confidence_score}%` : '0%'}</p>
                        <p className="text-[11px] text-slate-500">Percentage of standard product catalog fields filled</p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-xs text-slate-400 font-medium">AI Self-Trust Score</span>
                        <p className="text-2xl font-bold text-indigo-400">{item.field_confidence ? `${Math.round(item.field_confidence * 100)}%` : '—'}</p>
                        <p className="text-[11px] text-slate-500">Average self-reported confidence across 5 AI steps</p>
                      </div>
                    </div>

                    {/* Step Execution Timeline */}
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">5-Step AI Enrichment Execution Log</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="font-semibold text-slate-200">1. Manufacturer & Brand Cleansing</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="font-semibold text-slate-200">2. Category Taxonomy Tree Generation</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="font-semibold text-slate-200">3. Technical Attribute Extraction</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="font-semibold text-slate-200">4. Customer Description Formats</span>
                          <Badge variant="success" className="text-[10px]">Completed</Badge>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="font-semibold text-slate-200">5. Specifications & Universal Codes</span>
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
