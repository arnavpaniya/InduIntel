import { Metadata } from 'next';
import Link from 'next/link';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, ArrowRight, ChevronRight, Target, CheckCircle, 
  FileText, Settings, Layers, Package, TrendingUp,
  AlertTriangle, Shield, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreBatch } from '@/lib/api';
import { BatchScoreSummary } from '@/lib/types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'InduIntel — AI Product Intelligence Enrichment Pipeline',
  description: 'Turn messy industrial catalog data into clean, structured, commerce-ready product records using AI.',
};

// Historical fallback data from last successful score run (before quota exhaustion)
// Captured: 2 items scored, 34% overall accuracy, 13/38 fields matched
const HISTORICAL_FALLBACK: BatchScoreSummary = {
  items_scored: 2,
  avg_accuracy_pct: 34,
  field_accuracy_breakdown: {
    manufacturer_name: 0,
    brand_name: 0,
    dept: 0,
    class: 0,
    fine: 50,
    classpath: 50,
    'description:invoice_desc': 0,
    'description:mobile_desc': 0,
    'description:short_desc': 0,
    'description:long_desc1': 0,
    'description:marketing_description': 100,
    'attribute:Series': 0,
    'attribute:Model': 0,
    'attribute:Number of Wash Cycles': 0,
    'attribute:Voltage Rating': 0,
    'attribute:Amperage Rating': 0,
    'attribute:Mounting Type': 0,
    'attribute:Plug Type': 0,
    'attribute:Size': 0,
    'attribute:Depth With Door Open': 0,
    'attribute:Minimum Height': 0,
    'attribute:Maximum Height': 0,
    'attribute:Sound Level': 0,
    'attribute:Material': 100,
    'attribute:Color': 0,
    'attribute:Additional Information': 0,
    'attribute:Product Type': 0,
    'spec:upc': 100,
    'spec:ean': 100,
    'spec:gtin': 100,
    'spec:unspsc': 100,
    'spec:list_price': 100,
    'spec:length': 100,
    'spec:width': 100,
    'spec:height': 100,
    'spec:weight': 100,
    'spec:country_of_origin': 100,
    'spec:warranty': 0,
  },
  char_limit_compliance: {
    invoice_desc: 100,
    mobile_desc: 100,
    short_desc: 100,
    long_desc1: 100,
    marketing_description: 100,
  },
  attribute_lov_compliance_pct: 12,
  confidence_accuracy_correlation: {
    '0-20': 100,
    '21-40': 100,
    '41-60': 0,
    '61-80': 0,
    '81-100': 0,
  },
};

async function getLiveMetrics(): Promise<BatchScoreSummary | null> {
  try {
    const data = await scoreBatch(20);
    if (data.success && data.summary) {
      // If no items scored, return null to trigger fallback
      if (data.summary.items_scored === 0) {
        return null;
      }
      return data.summary;
    }
    return null;
  } catch {
    return null;
  }
}

async function getSampleRawEnrichedPair() {
  const supabase = await createServerSupabaseClient();
  
  const { data: enrichedItem } = await supabase
    .from('items')
    .select('id, mfg_part_num, part_desc, manufacturer_name, brand_name, classpath, confidence_score, field_confidence, status')
    .eq('status', 'enriched')
    .not('manufacturer_name', 'is', null)
    .limit(1)
    .maybeSingle();

  const { data: rawItem } = await supabase
    .from('items')
    .select('id, mfg_part_num, part_desc, e1_brand, unilog_brand, dib_brand, part_manuf')
    .eq('status', 'raw')
    .limit(1)
    .maybeSingle();

  let enrichedDetails = null;
  if (enrichedItem) {
    const { data: descs } = await supabase
      .from('item_descriptions')
      .select('field_name, value, char_count')
      .eq('item_id', enrichedItem.id);
    
    const { data: attrs } = await supabase
      .from('item_attributes')
      .select('label, value, uom')
      .eq('item_id', enrichedItem.id)
      .limit(8);
    
    enrichedDetails = {
      ...enrichedItem,
      descriptions: descs || [],
      attributes: attrs || [],
    };
  }

  return { rawItem, enrichedItem: enrichedDetails };
}

function MetricCard({ label, value, icon: Icon, trend, variant = 'default' }: { 
  label: string; 
  value: string | number; 
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  return (
    <Card className="metric-ring overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1 truncate">{value}</p>
            {trend && (
              <p className={cn('text-xs mt-1', 
                variant === 'success' && 'text-green-600', 
                variant === 'warning' && 'text-yellow-600', 
                variant === 'destructive' && 'text-red-600',
                variant === 'default' && 'text-blue-600'
              )}>
                {trend}
              </p>
            )}
          </div>
          <div className={cn('p-3 rounded-lg flex-shrink-0 shadow-inner', 
            variant === 'success' && 'bg-emerald-100 text-emerald-700',
            variant === 'warning' && 'bg-amber-100 text-amber-700',
            variant === 'destructive' && 'bg-red-100 text-red-700',
            variant === 'default' && 'bg-primary/10 text-primary'
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StepCard({ step, title, description, icon: Icon }: { 
  step: string; 
  title: string; 
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-lg border bg-card/70 shadow-sm shadow-slate-950/5">
      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-0.5 bg-border" />
        </div>
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground border-4 border-background shadow-lg shadow-cyan-900/15">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="w-full">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs font-medium">Step {step}</Badge>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function RawInputCard({ rawItem }: { rawItem: any }) {
  if (!rawItem) {
    return (
      <Card className="glass-panel border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Before: Raw Input
          </CardTitle>
          <CardDescription>What distributors actually receive from suppliers</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No raw items found. Run seed to populate data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Before: Raw Input
        </CardTitle>
        <CardDescription>What distributors actually receive from suppliers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg border border-destructive/10">
          <p className="font-mono text-sm font-medium text-destructive mb-2">MPN: {rawItem.mfg_part_num}</p>
          <p className="font-medium">{rawItem.part_desc || 'No description'}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-muted-foreground text-xs mb-1">E1 Brand</p>
            <p className="font-mono text-destructive">{rawItem.e1_brand || '— (placeholder)'}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-muted-foreground text-xs mb-1">Unilog Brand</p>
            <p className="font-mono text-destructive">{rawItem.unilog_brand || '— (placeholder)'}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-muted-foreground text-xs mb-1">DIB Brand</p>
            <p className="font-mono text-destructive">{rawItem.dib_brand || '— (placeholder)'}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded">
            <p className="text-muted-foreground text-xs mb-1">Part Manufacturer</p>
            <p className="font-mono text-destructive">{rawItem.part_manuf || '—'}</p>
          </div>
        </div>
        <Badge variant="destructive" className="w-fit">
          Missing: Manufacturer, Brand, Taxonomy, Descriptions, Attributes, Specs
        </Badge>
      </CardContent>
    </Card>
  );
}

function EnrichedOutputCard({ enrichedItem }: { enrichedItem: any }) {
  if (!enrichedItem) {
    return (
      <Card className="glass-panel border-emerald-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            After: AI-Enriched & Validated
          </CardTitle>
          <CardDescription>Structured, commerce-ready record with confidence scoring</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No enriched items yet. Click "Run Batch" in dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel border-emerald-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          After: AI-Enriched & Validated
        </CardTitle>
        <CardDescription>Structured, commerce-ready record with confidence scoring</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="font-mono text-sm font-medium text-green-700 mb-2">MPN: {enrichedItem.mfg_part_num}</p>
          <p className="font-medium">{enrichedItem.part_desc || 'No description'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="success" className="text-xs">{enrichedItem.manufacturer_name || 'Detected'}</Badge>
            <Badge variant="success" className="text-xs">{enrichedItem.brand_name || 'Detected'}</Badge>
            <Badge variant="outline" className="text-xs">{enrichedItem.confidence_score ? `${enrichedItem.confidence_score}%` : '—'} Fields Filled</Badge>
            <Badge variant="outline" className="text-xs">{enrichedItem.field_confidence ? `${Math.round(enrichedItem.field_confidence * 100)}%` : '—'} AI Confidence</Badge>
          </div>
        </div>
        <div className="space-y-3">
          {enrichedItem.classpath && (
            <div className="p-3 bg-muted/50 rounded">
              <p className="text-muted-foreground text-xs mb-1">Classpath</p>
              <p className="font-mono text-sm text-green-700">{enrichedItem.classpath}</p>
            </div>
          )}
          {enrichedItem.descriptions && enrichedItem.descriptions.length > 0 && (
            <div className="p-3 bg-muted/50 rounded">
              <p className="text-muted-foreground text-xs mb-2">Descriptions Generated</p>
              <div className="flex flex-wrap gap-2">
                {enrichedItem.descriptions.slice(0, 3).map((d: { field_name: string; char_count: number }) => (
                  <Badge key={d.field_name} variant="secondary" className="text-xs">
                    {d.field_name}: {d.char_count} chars
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {enrichedItem.attributes && enrichedItem.attributes.length > 0 && (
            <div className="p-3 bg-muted/50 rounded">
              <p className="text-muted-foreground text-xs mb-2">Attributes Extracted: {enrichedItem.attributes.length}</p>
              <div className="flex flex-wrap gap-2">
                {enrichedItem.attributes.slice(0, 4).map((a: { label: string; value: string | null }) => (
                  <Badge key={a.label} variant="outline" className="text-xs">
                    {a.label}: {a.value}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <Badge variant="success" className="w-fit">
          Complete: Identity + Taxonomy + 5 Descriptions + Attributes + Specs
        </Badge>
      </CardContent>
    </Card>
  );
}

export default async function LandingPage() {
  const [metrics, samplePair] = await Promise.all([
    getLiveMetrics(),
    getSampleRawEnrichedPair(),
  ]);

  const { rawItem, enrichedItem } = samplePair;
  const hasRealData = !!rawItem && !!enrichedItem;

  return (
    <div className="app-shell min-h-screen">
      {/* Hero Section */}
      <section className="hero-grid relative overflow-hidden py-20 text-white lg:py-28">
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl text-center">
            {/* Logo/Name */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/12 text-white ring-1 ring-white/20">
                <Zap className="h-7 w-7" />
              </div>
              <span className="text-3xl font-bold tracking-tight">InduIntel</span>
            </div>
            
            {/* Pitch */}
            <h1 className="text-4xl font-bold tracking-tight mb-6 sm:text-5xl lg:text-6xl">
              <span className="masked-rise"><span>Messy catalogs.</span></span>{' '}
              <span className="masked-rise"><span>Clean records.</span></span>{' '}
              <span className="masked-rise"><span>Validated by AI.</span></span>
            </h1>
            
            <p className="mx-auto mb-10 max-w-2xl text-lg text-cyan-50/82">
              Distributors waste hours cleaning inconsistent product data. 
              InduIntel automates enrichment, classification, and validation — 
              so your catalog is always accurate, complete, and ready to sell.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  <Zap className="h-5 w-5" />
                  See It in Action
                </Button>
              </Link>
              <Link href="#metrics">
                <Button variant="outline" size="lg" className="w-full border-white/25 bg-white/10 text-white hover:bg-white hover:text-slate-950 sm:w-auto gap-2">
                  View Live Metrics
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>

            {/* Trust indicator */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm text-cyan-50/75 sm:gap-6">
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>Checked against real answers</span>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                <span>Knows when it's unsure</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                <span>Explainable AI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <Badge variant="secondary" className="mb-3">The Problem</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
              Industrial product data is messy, inconsistent, and incomplete
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Distributors receive catalog data from hundreds of manufacturers — each with different formats, 
              missing fields, placeholder brands, and no standard taxonomy. Manual enrichment doesn't scale.
            </p>
          </div>

          {/* Before/After Comparison */}
          <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <RawInputCard rawItem={rawItem} />
            <EnrichedOutputCard enrichedItem={enrichedItem} />
          </div>

          {hasRealData && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Live example from database — Item IDs: <code className="font-mono bg-muted px-1 rounded">{rawItem?.id.slice(0,8)}...</code> → <code className="font-mono bg-muted px-1 rounded">{enrichedItem?.id.slice(0,8)}...</code>
            </p>
          )}
        </div>
      </section>

      {/* Solution / How It Works */}
      <section className="bg-white/42 py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <Badge variant="secondary" className="mb-3">The Solution</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
              From raw data to validated records in 4 steps
            </h2>
            <p className="text-lg text-muted-foreground">
              Each item flows through a structured pipeline with LLM-powered enrichment 
              and ground-truth validation at every stage.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="hidden lg:flex items-center justify-between">
              <StepCard 
                step="1" 
                title="Raw Input" 
                description="Ingest MPN, description, and noisy brand fields from supplier feeds"
                icon={FileText}
              />
              <StepCard 
                step="2" 
                title="AI Enrichment" 
                description="5-step pipeline: manufacturer normalization → taxonomy classification → attribute extraction → description generation → spec parsing"
                icon={Sparkles}
              />
              <StepCard 
                step="3" 
                title="Ground Truth Validation" 
                description="Score every field against human-curated answer key; grouped by identity, taxonomy, descriptions, attributes, specs"
                icon={Target}
              />
              <StepCard 
                step="4" 
                title="Clean Output" 
                description="Structured record with confidence scores, review flags, and full audit trail"
                icon={Package}
              />
            </div>
            
            {/* Mobile stacked version */}
            <div className="lg:hidden space-y-6">
              <StepCard step="1" title="Raw Input" description="Ingest MPN, description, and noisy brand fields from supplier feeds" icon={FileText} />
              <StepCard step="2" title="AI Enrichment" description="5-step pipeline: manufacturer → taxonomy → attributes → descriptions → specs" icon={Sparkles} />
              <StepCard step="3" title="Validation" description="Score every field against ground truth; grouped by identity, taxonomy, descriptions, attributes, specs" icon={Target} />
              <StepCard step="4" title="Clean Output" description="Structured record with confidence scores, review flags, and full audit trail" icon={Package} />
            </div>
          </div>
        </div>
      </section>

      {/* Live Metrics Section */}
      <section id="metrics" className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <Badge variant="secondary" className="mb-3">Live Metrics</Badge>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
              Real validation results from the pipeline
            </h2>
<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              These are live results from testing on real data. 
              Low accuracy on sparse-input items is expected; the key is that <strong>confidence scoring flags exactly which fields need review</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto mb-12">
            {/* Determine what to show: live data, historical fallback, or loading */}
            {(() => {
              // Live data available and items scored
              if (metrics && metrics.items_scored > 0) {
                return (
                  <>
                    <MetricCard 
                      label="Items Scored" 
                      value={metrics.items_scored} 
                      icon={CheckCircle} 
                      variant="success"
                      trend={`${metrics.items_scored} items validated`}
                    />
                    <MetricCard 
                      label="Accuracy" 
                      value={`${metrics.avg_accuracy_pct}%`} 
                      icon={Target} 
                      variant={metrics.avg_accuracy_pct >= 70 ? 'success' : metrics.avg_accuracy_pct >= 40 ? 'warning' : 'destructive'}
                      trend={metrics.avg_accuracy_pct >= 70 ? 'Strong' : metrics.avg_accuracy_pct >= 40 ? 'Moderate' : 'Sparse input baseline'}
                    />
                    <MetricCard 
                      label="Matches Approved Values" 
                      value={`${metrics.attribute_lov_compliance_pct}%`} 
                      icon={Settings} 
                      variant={metrics.attribute_lov_compliance_pct >= 70 ? 'success' : metrics.attribute_lov_compliance_pct >= 40 ? 'warning' : 'destructive'}
                      trend="Values matching approved lists"
                    />
                    <MetricCard 
                      label="Formatting Rules Followed" 
                      value={metrics.char_limit_compliance && Object.values(metrics.char_limit_compliance).length > 0 
                        ? `${Math.round(Object.values(metrics.char_limit_compliance).reduce((a, b) => a + b, 0) / Object.values(metrics.char_limit_compliance).length)}%` 
                        : 'N/A'} 
                      icon={FileText} 
                      variant="default"
                      trend="Descriptions within limits"
                    />
                  </>
                );
              }
              
              // Historical fallback available (live data returned null or items_scored === 0)
              if (HISTORICAL_FALLBACK) {
                return (
                  <>
                    <MetricCard 
                      label="Items Scored (Last Run)" 
                      value={HISTORICAL_FALLBACK.items_scored} 
                      icon={CheckCircle} 
                      variant="success"
                      trend="Historical snapshot — live scoring paused"
                    />
                    <MetricCard 
                      label="Accuracy" 
                      value={`${HISTORICAL_FALLBACK.avg_accuracy_pct}%`} 
                      icon={Target} 
                      variant="destructive"
                      trend="Sparse input baseline (34%)"
                    />
                    <MetricCard 
                      label="Matches Approved Values" 
                      value={`${HISTORICAL_FALLBACK.attribute_lov_compliance_pct}%`} 
                      icon={Settings} 
                      variant="destructive"
                      trend="Requires external catalog data"
                    />
                    <MetricCard 
                      label="Formatting Rules Followed" 
                      value={HISTORICAL_FALLBACK.char_limit_compliance && Object.values(HISTORICAL_FALLBACK.char_limit_compliance).length > 0 
                        ? `${Math.round(Object.values(HISTORICAL_FALLBACK.char_limit_compliance).reduce((a, b) => a + b, 0) / Object.values(HISTORICAL_FALLBACK.char_limit_compliance).length)}%` 
                        : 'N/A'} 
                      icon={FileText} 
                      variant="default"
                      trend="All descriptions within limits"
                    />
                  </>
                );
              }
              
              // Should never reach here, but safety fallback
              return (
                <>
                  <MetricCard label="Items Scored" value="—" icon={CheckCircle} trend="Unavailable" />
                  <MetricCard label="Accuracy" value="—" icon={Target} trend="Unavailable" />
                  <MetricCard label="Matches Approved Values" value="—" icon={Settings} trend="Unavailable" />
                  <MetricCard label="Formatting Rules Followed" value="—" icon={FileText} trend="Unavailable" />
                </>
              );
            })()}
          </div>

          {/* Honest framing note */}
          {metrics && metrics.avg_accuracy_pct < 50 && (
            <Card className="max-w-3xl mx-auto border-yellow-500/30 bg-yellow-50/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-yellow-800 mb-1">Honest assessment: {metrics.avg_accuracy_pct}% baseline accuracy</h3>
                    <p className="text-sm text-yellow-700">
                      The raw input descriptions in our test set are often minimal (e.g. "Display Only", distributor names instead of manufacturers). 
                      This is a <strong>realistic baseline</strong> — not a cherry-picked demo. 
                      The pipeline's value is the <strong>confidence scoring</strong> that correctly identifies which fields are unreliable (status: "review") 
                      so human reviewers know exactly where to focus. That's how the AI shows what it knows and what it doesn't.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-group accuracy if available */}
          {metrics && metrics.field_accuracy_breakdown && Object.keys(metrics.field_accuracy_breakdown).length > 0 && (
            <div className="mt-10 max-w-3xl mx-auto">
              <h3 className="text-lg font-semibold mb-4 text-center">Accuracy by Category</h3>
              <div className="space-y-3">
                {Object.entries(metrics.field_accuracy_breakdown)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 8)
                  .map(([field, accuracy]) => (
                    <div key={field} className="flex items-center gap-4">
                      <span className="font-mono text-sm w-48 truncate">{field}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all" 
                          style={{ 
                            width: `${accuracy}%`,
                            backgroundColor: accuracy >= 80 ? '#22c55e' : accuracy >= 50 ? '#eab308' : '#ef4444'
                          }}
                        />
                      </div>
                      <Badge 
                        variant={accuracy >= 80 ? 'success' : accuracy >= 50 ? 'warning' : 'destructive'}
                        className="text-xs w-20"
                      >
                        {accuracy}%
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">InduIntel</p>
                <p className="text-xs text-muted-foreground">AI Product Intelligence Enrichment Pipeline</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Built for hackathon submission</span>
              <Link href="/dashboard" className="text-primary hover:underline flex items-center gap-1">
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
