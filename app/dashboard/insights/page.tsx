'use client';

import { useState, useEffect } from 'react';
import { motion, type Variants } from 'motion/react';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  BarChart2, Target, TrendingUp, AlertTriangle, CheckCircle, 
  Zap, RefreshCw, Download, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreBatch } from '@/lib/api';
import { BatchScoreSummary, BatchScoreResponse } from '@/lib/types';

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: 'easeOut' } },
};

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

function StatCard({ title, value, icon: Icon, trend, variant = 'default' }: { 
  title: string; 
  value: string | number; 
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  return (
    <motion.div variants={panelVariants} layout>
    <Card className="metric-ring overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {trend && (
              <p className={cn('text-xs mt-1', variant === 'success' ? 'text-green-600' : variant === 'warning' ? 'text-yellow-600' : 'text-red-600')}>
                {trend}
              </p>
            )}
          </div>
          <div className={cn('p-3 rounded-lg shadow-inner', 
            variant === 'success' && 'bg-emerald-100 text-emerald-700',
            variant === 'warning' && 'bg-amber-100 text-amber-700',
            variant === 'destructive' && 'bg-red-100 text-red-700',
            variant === 'default' && 'bg-blue-100 text-blue-600'
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
}

function GroupAccuracyChart({ data }: { data: Array<{ group: string; accuracy: number; matched: number; total: number; reason?: string }> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5" />
          Accuracy by Field Group
        </CardTitle>
        <CardDescription>Percentage of fields matching ground truth per category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="group" width={120} tick={{ fontSize: 12 }} />
              <Tooltip 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => value !== undefined ? [`${value}%`, 'Accuracy'] : ['', '']}
                labelFormatter={(group) => group}
              />
              <Bar dataKey="accuracy" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {data.map((entry) => (
            <div key={entry.group} className="flex items-center gap-3">
              <div className="w-32 text-sm font-medium capitalize">{entry.group}</div>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all" 
                  style={{ 
                    width: `${entry.accuracy}%`,
                    backgroundColor: entry.accuracy >= 80 ? '#22c55e' : entry.accuracy >= 50 ? '#eab308' : '#ef4444'
                  }}
                />
              </div>
              <span className="text-sm font-medium w-16 text-right">{entry.accuracy}%</span>
              <span className="text-xs text-muted-foreground w-20 text-right">{entry.matched}/{entry.total}</span>
              {entry.reason && (
                <Badge variant="outline" className="text-xs ml-2">{entry.reason.replace('_', ' ')}</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConfidenceCorrelationChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([bin, accuracy]) => ({
    bin,
    accuracy,
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Confidence-Accuracy Correlation
        </CardTitle>
        <CardDescription>
          Does high confidence predict high accuracy? Bins show accuracy % for items in each confidence range.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="bin" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any) => value !== undefined ? [`${value}%`, 'Accuracy'] : ['', '']} />
              <Bar dataKey="accuracy" fill="#8b5cf6" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.accuracy >= 70 ? '#22c55e' : entry.accuracy >= 40 ? '#eab308' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {chartData.map((entry) => (
            <div key={entry.bin} className="flex items-center gap-3">
              <div className="w-20 text-sm font-medium">{entry.bin}% conf.</div>
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all" 
                  style={{ 
                    width: `${entry.accuracy}%`,
                    backgroundColor: entry.accuracy >= 70 ? '#22c55e' : entry.accuracy >= 40 ? '#eab308' : '#ef4444'
                  }}
                />
              </div>
              <span className="text-sm font-medium w-16 text-right">{entry.accuracy}%</span>
              <span className="text-xs text-muted-foreground">
                {entry.accuracy >= 70 ? '✓ Well calibrated' : entry.accuracy >= 40 ? '⚠ Moderate' : '✗ Poor correlation'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CharLimitComplianceChart({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([field, compliance]) => ({
    field: field.replace('_', ' '),
    compliance,
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Character Limit Compliance
        </CardTitle>
        <CardDescription>Percentage of descriptions within character limits</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="field" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: any) => value !== undefined ? [`${value}%`, 'Compliance'] : ['', '']} />
              <Bar dataKey="compliance" fill="#06b6d4" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.compliance === 100 ? '#22c55e' : entry.compliance >= 50 ? '#eab308' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InsightsPage() {
  const [summary, setSummary] = useState<BatchScoreSummary | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await scoreBatch(20);
      if (data.success) {
        setSummary(data.summary);
        setResults(data.results);
      } else {
        setError('Failed to load insights');
      }
    } catch (err) {
      console.error('Failed to load insights:', err);
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  if (loading) {
    return (
      <div className="app-shell container mx-auto px-4 py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-shell container mx-auto px-4 py-12 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to load insights</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={loadInsights}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!summary || summary.items_scored === 0) {
    return (
      <div className="app-shell container mx-auto px-4 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart2 className="h-8 w-8 text-primary" />
            Insights
          </h1>
          <p className="text-muted-foreground mt-2">Aggregate metrics from Stage 3 validation</p>
        </header>
        
        <Card className="glass-panel text-center py-12 max-w-2xl mx-auto">
          <CardContent>
            <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No validation data yet</h2>
            <p className="text-muted-foreground mb-6">
              Run the scoring batch to generate insights. You need at least one enriched item with matching ground truth.
            </p>
            <Button onClick={loadInsights}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare group accuracy data for chart
  let groupAccuracyData: Array<{ group: string; accuracy: number; matched: number; total: number; reason?: string }> = [];

  // If we have actual group data from results, compute it properly
  if (results.length > 0 && results[0].group_scores) {
    const groupMap = new Map<string, { total: number; matched: number; reason?: string }>();
    
    results.forEach(r => {
      r.group_scores?.forEach((g: any) => {
        const existing = groupMap.get(g.group) || { total: 0, matched: 0, reason: g.reason_tag };
        existing.total += g.total;
        existing.matched += g.matched;
        if (g.reason_tag) existing.reason = g.reason_tag;
        groupMap.set(g.group, existing);
      });
    });

    groupAccuracyData = Array.from(groupMap.entries()).map(([group, stats]) => ({
      group,
      accuracy: stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0,
      matched: stats.matched,
      total: stats.total,
      reason: stats.reason,
    }));
  }

  // Fallback if no group data
  if (groupAccuracyData.length === 0) {
    groupAccuracyData = [
      { group: 'identity', accuracy: summary.field_accuracy_breakdown?.manufacturer_name || 0, matched: 0, total: 0, reason: 'requires_external_source' },
      { group: 'taxonomy', accuracy: summary.field_accuracy_breakdown?.dept || 0, matched: 0, total: 0, reason: 'taxonomy_granularity_mismatch' },
      { group: 'descriptions', accuracy: summary.field_accuracy_breakdown?.['description:invoice_desc'] || 0, matched: 0, total: 0, reason: 'input_too_sparse' },
      { group: 'attributes', accuracy: summary.attribute_lov_compliance_pct || 0, matched: 0, total: 0, reason: 'requires_external_source' },
      { group: 'specs', accuracy: summary.field_accuracy_breakdown?.['spec:upc'] || 0, matched: 0, total: 0, reason: 'requires_external_source' },
    ].filter(g => g.accuracy > 0 || (summary.field_accuracy_breakdown && Object.keys(summary.field_accuracy_breakdown).some(k => k.startsWith(g.group))));
  }

  return (
    <div className="app-shell min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/82 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-cyan-900/15">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Insights</h1>
              <p className="text-sm text-muted-foreground">Aggregate metrics from Stage 3 validation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadInsights} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
          <Card className={cn('w-80', toast.type === 'error' && 'border-destructive')}>
            <CardContent className="p-4 flex items-center gap-3">
              {toast.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {toast.type === 'error' && <AlertTriangle className="h-5 w-5 text-destructive" />}
              {toast.type === 'info' && <Zap className="h-5 w-5 text-blue-500" />}
              <p className="text-sm">{toast.message}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats */}
        <motion.div
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard 
            title="Items Scored" 
            value={summary.items_scored} 
            icon={CheckCircle} 
            variant="success"
          />
          <StatCard 
            title="Avg Accuracy" 
            value={`${summary.avg_accuracy_pct}%`} 
            icon={Target} 
            variant={summary.avg_accuracy_pct >= 70 ? 'success' : summary.avg_accuracy_pct >= 40 ? 'warning' : 'destructive'}
          />
          <StatCard 
            title="Attr LOV Compliance" 
            value={`${summary.attribute_lov_compliance_pct}%`} 
            icon={Settings} 
            variant={summary.attribute_lov_compliance_pct >= 70 ? 'success' : summary.attribute_lov_compliance_pct >= 40 ? 'warning' : 'destructive'}
          />
          <StatCard 
            title="Char Limit Compliance" 
            value={summary.char_limit_compliance && Object.values(summary.char_limit_compliance).length > 0 
              ? `${Math.round(Object.values(summary.char_limit_compliance).reduce((a, b) => a + b, 0) / Object.values(summary.char_limit_compliance).length)}%` 
              : 'N/A'} 
            icon={TrendingUp} 
            variant="default"
          />
        </motion.div>

        {/* Charts Row 1 */}
        <motion.div variants={gridVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div variants={panelVariants}>
          <GroupAccuracyChart data={groupAccuracyData} />
          </motion.div>
          <motion.div variants={panelVariants}>
          <ConfidenceCorrelationChart data={summary.confidence_accuracy_correlation || {}} />
          </motion.div>
        </motion.div>

        {/* Charts Row 2 */}
        <motion.div variants={gridVariants} initial="hidden" animate="show" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div variants={panelVariants}>
          <CharLimitComplianceChart data={summary.char_limit_compliance || {}} />
          </motion.div>
          
          {/* Field Accuracy Breakdown Table */}
          <motion.div variants={panelVariants}>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Field-Level Accuracy Breakdown
              </CardTitle>
              <CardDescription>Per-field accuracy across all scored items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Field</th>
                      <th className="pb-2 pr-4 text-right">Accuracy</th>
                      <th className="pb-2 pr-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.field_accuracy_breakdown || {})
                      .sort(([,a], [,b]) => b - a)
                      .map(([field, accuracy]) => (
                        <tr key={field} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-sm">{field}</td>
                          <td className="py-2 pr-4 text-right font-medium">{accuracy}%</td>
                          <td className="py-2 text-right">
                            <Badge 
                              variant={accuracy >= 80 ? 'success' : accuracy >= 50 ? 'warning' : 'destructive'}
                              className="text-xs"
                            >
                              {accuracy >= 80 ? 'Good' : accuracy >= 50 ? 'Fair' : 'Poor'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </motion.div>

        {/* Detailed Results */}
        {results.length > 0 && (
          <motion.div variants={panelVariants} initial="hidden" animate="show">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Individual Item Results
                </span>
                <Badge variant="outline">{results.length} items scored</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">MPN</th>
                      <th className="pb-2 pr-4 text-center">Overall</th>
                      <th className="pb-2 pr-4 text-center">Identity</th>
                      <th className="pb-2 pr-4 text-center">Taxonomy</th>
                      <th className="pb-2 pr-4 text-center">Descriptions</th>
                      <th className="pb-2 pr-4 text-center">Attributes</th>
                      <th className="pb-2 pr-4 text-center">Specs</th>
                      <th className="pb-2 pr-4 text-center">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.item_id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 pr-4 font-mono font-medium">{r.mfg_part_num}</td>
                        <td className="py-3 pr-4 text-center">
                          <Badge variant={r.overall_accuracy_pct >= 80 ? 'success' : r.overall_accuracy_pct >= 50 ? 'warning' : 'destructive'}>
                            {r.overall_accuracy_pct}%
                          </Badge>
                        </td>
                        {r.group_scores?.map((g: any) => (
                          <td key={g.group} className="py-3 pr-4 text-center">
                            <Badge variant={g.accuracy_pct >= 80 ? 'success' : g.accuracy_pct >= 50 ? 'warning' : 'destructive'} className="text-xs">
                              {g.accuracy_pct}%
                            </Badge>
                          </td>
                        ))}
                        <td className="py-3 pr-4 text-center text-muted-foreground">
                          {r.confidence_accuracy_correlation?.confidence_score ?? '—'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        )}

        {/* Correlation Note */}
        <Card className="glass-panel border-primary/50 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium text-primary">Key Insight: Confidence-Accuracy Correlation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  The chart above shows whether the system's confidence scores reliably predict actual accuracy. 
                  <strong>Green bars</strong> indicate well-calibrated confidence (high confidence → high accuracy). 
                  <strong>Yellow/red bars</strong> suggest overconfidence or underconfidence. 
                  This "explainable AI" metric proves the system knows what it doesn't know — a key differentiator for production deployment.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
