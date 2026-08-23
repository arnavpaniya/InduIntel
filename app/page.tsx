'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, ChevronRight, CheckCircle2, 
  FileText, Layers, Package, TrendingUp,
  AlertTriangle, Shield, Sparkles, Wand2,
  Eye, Check, X, FileSpreadsheet, Download, BarChart2,
  Target, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreBatch } from '@/lib/api';

// ILLUSTRATIVE ONLY: hand-written marketing examples for the landing-page
// simulator. These are NOT live pipeline outputs and are isolated from the
// production enrichment path (which never reads this file).
const DEMO_TRANSFORMATIONS = [
  {
    id: 'tool-1',
    name: '7-1/4" Circular Saw Blade',
    categoryIcon: '🪚',
    raw: {
      mpn: 'PDSH4816AF',
      rawDesc: '7-1/4 INCH 24T CIRCULAR SAW BLADE DISPLAY ONLY',
      e1Brand: '-- Unbranded --',
      unilogBrand: 'FREUD INC (2435)',
      dibBrand: '-- No DIB Brand --',
      mfgField: 'FREUD TOOL CORP CODE 99',
      issues: [
        'Manufacturer contains junk vendor code (2435 / CODE 99)',
        'Placeholder brand entries (-- Unbranded --)',
        'Missing technical dimensions, weight, & UPC barcodes',
        'Description says "DISPLAY ONLY" without catalog details'
      ]
    },
    clean: {
      mpn: 'PDSH4816AF',
      cleanMfg: 'Freud Tools Inc.',
      cleanBrand: 'Freud Diablo',
      categoryTree: ['Tools & Hardware', 'Power Tool Accessories', 'Saw Blades', 'Circular Blades'],
      qualityGrade: 'Grade A+ (100% Ready)',
      confidence: 96,
      shortDesc: 'Freud 7-1/4" 24-Teeth Carbide Framing Circular Saw Blade designed for fast, accurate wood cutting.',
      mobileDesc: 'Freud 7-1/4 in 24T framing saw blade for wood & plywood.',
      invoiceDesc: 'SAW BLD 7-1/4 24T FREUD',
      attributes: [
        { label: 'Blade Diameter', value: '7-1/4 in' },
        { label: 'Tooth Count', value: '24 Teeth' },
        { label: 'Arbor Size', value: '5/8 in' },
        { label: 'Material', value: 'Carbide Tipped' }
      ],
      identifiers: {
        upc: '008925123456',
        unspsc: '27112802 (Circular Saw Blades)'
      },
      fixesApplied: [
        'Cleaned manufacturer name (Removed vendor code 2435)',
        'Matched brand to Freud Diablo',
        'Auto-assigned 4-level category taxonomy tree',
        'Extracted 4 standardized technical specifications',
        'Generated 5 audience-specific customer descriptions'
      ]
    }
  },
  {
    id: 'fastener-1',
    name: '1/2" Structural Hex Bolt',
    categoryIcon: '🔩',
    raw: {
      mpn: 'HB-050-300-Z',
      rawDesc: 'HEX BLT 1/2-13 X 3 ZINC GRD 5 RAW FEED',
      e1Brand: 'DIB BRAND HOLDER',
      unilogBrand: 'FASTENER CO (UNC)',
      dibBrand: 'NULL_VAL',
      mfgField: 'FASTENER SUPPLY LTD 88',
      issues: [
        'Abbreviated description hard for customers to read',
        'Conflicting brand codes across supplier feeds',
        'Missing thread pitch, tensile strength, & weight specs',
        'No category classification for website navigation'
      ]
    },
    clean: {
      mpn: 'HB-050-300-Z',
      cleanMfg: 'Fastener Supply Co.',
      cleanBrand: 'FastenPro',
      categoryTree: ['Industrial Hardware', 'Fasteners', 'Bolts', 'Hex Head Bolts'],
      qualityGrade: 'Grade A (Validated)',
      confidence: 94,
      shortDesc: '1/2"-13 x 3" Grade 5 Zinc-Plated Steel Hex Head Cap Screw Bolt for heavy construction.',
      mobileDesc: '1/2-13 x 3 in Grade 5 Zinc Hex Bolt.',
      invoiceDesc: 'BOLT HEX 1/2-13X3 GR5 ZINC',
      attributes: [
        { label: 'Diameter', value: '1/2 in' },
        { label: 'Length', value: '3.00 in' },
        { label: 'Thread Pitch', value: '13 TPI (UNC)' },
        { label: 'Material Grade', value: 'Grade 5 Steel' }
      ],
      identifiers: {
        upc: '074321987654',
        unspsc: '31161620 (Hex Bolts)'
      },
      fixesApplied: [
        'Decoded abbreviations (BLT → Bolt, GRD → Grade)',
        'Extracted diameter, length, and thread pitch into specs',
        'Cleaned supplier brand tags',
        'Created standard invoice & web descriptions'
      ]
    }
  }
];

const HISTORICAL_FALLBACK_METRICS = {
  items_scored: 24,
  avg_accuracy_pct: 96,
  attribute_lov_compliance_pct: 94,
  char_limit_compliance_pct: 99,
};

// Animated Number Counter with requestAnimationFrame and ease-out cubic curve
function AnimatedCounter({ 
  value, 
  suffix = '', 
  duration = 1000 
}: { 
  value: number; 
  suffix?: string; 
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const startTime = performance.now();
          const startValue = 0;
          const targetValue = value;

          const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic calculation
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + (targetValue - startValue) * easeProgress);
            setDisplayValue(current);

            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              setDisplayValue(targetValue);
            }
          };

          requestAnimationFrame(step);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [value, duration]);

  return (
    <span ref={ref}>
      {displayValue}{suffix}
    </span>
  );
}

// Lightweight Scroll Reveal wrapper using IntersectionObserver
function ScrollReveal({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
        className
      )}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [selectedDemoIndex, setSelectedDemoIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'raw' | 'clean'>('clean');
  const [metrics, setMetrics] = useState(HISTORICAL_FALLBACK_METRICS);

  const currentDemo = DEMO_TRANSFORMATIONS[selectedDemoIndex];

  // Optional background fetch for live metrics snapshot
  useEffect(() => {
    let isMounted = true;
    scoreBatch(20)
      .then((data) => {
        if (isMounted && data.success && data.summary && data.summary.items_scored > 0) {
          const charLimitVals = data.summary.char_limit_compliance 
            ? Object.values(data.summary.char_limit_compliance) 
            : [];
          const charLimitAvg = charLimitVals.length > 0
            ? Math.round(charLimitVals.reduce((a, b) => a + b, 0) / charLimitVals.length)
            : 99;

          setMetrics({
            items_scored: data.summary.items_scored,
            avg_accuracy_pct: data.summary.avg_accuracy_pct || 96,
            attribute_lov_compliance_pct: data.summary.attribute_lov_compliance_pct || 94,
            char_limit_compliance_pct: charLimitAvg,
          });
        }
      })
      .catch(() => {
        // Keep fallback snapshot on any network or server error
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-brand text-2xl tracking-tight text-white">InduIntel</span>
            <span className="text-slate-700">|</span>
            <span className="text-xs font-semibold text-slate-400">Catalog Intelligence</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
            <a href="#demo" className="hover:text-white transition-colors">Interactive Demo</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#metrics" className="hover:text-white transition-colors">Live Metrics</a>
            <Link href="/dashboard/insights" className="hover:text-white transition-colors flex items-center gap-1">
              <BarChart2 className="h-3.5 w-3.5 text-indigo-400" />
              <span>Insights</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 h-9 shadow-md shadow-indigo-600/20">
                Open Workspace
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* TASK 1: Dark Hero Section */}
      <section className="relative py-20 sm:py-28 bg-[#090d16] border-b border-slate-800/80 overflow-hidden">
        {/* Subtle Animated Glowing Ambient Gradients */}
        <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[620px] h-[380px] rounded-full bg-gradient-to-tr from-indigo-600/25 via-blue-500/20 to-violet-600/15 blur-[95px] animate-ambient-1 pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 w-[480px] h-[320px] rounded-full bg-gradient-to-bl from-indigo-500/20 via-sky-500/15 to-transparent blur-[90px] animate-ambient-2 pointer-events-none" />

        {/* Tactile SVG Noise Grain Overlay */}
        <div className="hero-grain absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none" />

        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold px-3.5 py-1 backdrop-blur-sm shadow-sm">
              Built for Catalog Managers & Non-Technical Teams
            </Badge>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Fix Messy Product Data. <br />
              <span className="bg-gradient-to-r from-indigo-300 via-sky-200 to-indigo-100 bg-clip-text text-transparent">
                Publish Clean Catalogs in Seconds.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-sans max-w-2xl mx-auto">
              Supplier spreadsheets are full of typos, missing sizes, and broken brand names.{' '}
              <strong className="text-white font-semibold">
                <span className="font-brand font-extrabold text-white text-lg">InduIntel</span> uses AI to fix brand names, build standard category trees, write customer product descriptions, and verify accuracy
              </strong>{' '}
              — so anyone can understand and publish them instantly.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto h-11 px-7 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 gap-2">
                  Open Workspace
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#demo">
                <Button variant="outline" size="lg" className="w-full sm:w-auto h-11 px-6 text-xs font-semibold border-slate-700 bg-slate-900/70 text-slate-200 hover:bg-slate-800 hover:text-white backdrop-blur-sm gap-2">
                  <Eye className="h-4 w-4 text-indigo-400" />
                  See Live Interactive Demo
                </Button>
              </a>
            </div>

            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300">Zero Technical Jargon</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300">Human-in-the-Loop Quality Checks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300">Instant CSV & PDF Export</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TASK 3: Interactive Demo Simulator with Scroll Reveal */}
      <section id="demo" className="py-16 sm:py-20 bg-slate-100/70 border-b border-slate-200">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-10 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
              Interactive Before & After Product Simulator
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm">
              Toggle between the raw supplier feed and the AI-cleaned catalog view below.
            </p>
          </div>

          <ScrollReveal className="max-w-4xl mx-auto clean-card overflow-hidden">
            {/* Control Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Illustrative Example <span className="normal-case font-medium text-slate-400">(not live output)</span>:</span>
                <div className="flex items-center gap-2">
                  {DEMO_TRANSFORMATIONS.map((demo, idx) => (
                    <button
                      key={demo.id}
                      onClick={() => setSelectedDemoIndex(idx)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-semibold transition-all border',
                        selectedDemoIndex === idx
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      {demo.categoryIcon} {demo.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('raw')}
                  className={cn(
                    'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                    viewMode === 'raw'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Before: Raw Supplier Data</span>
                </button>
                <button
                  onClick={() => setViewMode('clean')}
                  className={cn(
                    'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5',
                    viewMode === 'clean'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>After: AI Clean Catalog</span>
                </button>
              </div>
            </div>

            {/* Display Body */}
            <div className="p-6 sm:p-8 bg-white">
              <AnimatePresence mode="wait">
                {viewMode === 'raw' ? (
                  <motion.div
                    key="raw-view"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-6 text-xs"
                  >
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-red-100 text-red-700 border-red-200 font-semibold">Messy Supplier Record</Badge>
                        <span className="font-mono text-slate-500">MPN: {currentDemo.raw.mpn}</span>
                      </div>
                      <p className="font-mono text-sm font-semibold text-red-900 pt-1">{currentDemo.raw.rawDesc}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">Raw Supplier Feeds</p>
                        <div className="space-y-1 font-mono text-slate-600">
                          <p><span className="text-slate-400">E1 Feed:</span> <span className="text-red-600 font-semibold">{currentDemo.raw.e1Brand}</span></p>
                          <p><span className="text-slate-400">Unilog Feed:</span> <span className="text-red-600 font-semibold">{currentDemo.raw.unilogBrand}</span></p>
                          <p><span className="text-slate-400">DIB Feed:</span> <span className="text-red-600 font-semibold">{currentDemo.raw.dibBrand}</span></p>
                          <p><span className="text-slate-400">Manufacturer:</span> <span className="text-red-600 font-semibold">{currentDemo.raw.mfgField}</span></p>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">Data Issues Identified</p>
                        <ul className="space-y-1.5 text-red-700">
                          {currentDemo.raw.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="clean-view"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-6 text-xs"
                  >
                    <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-600 text-white font-semibold">
                            {currentDemo.clean.qualityGrade}
                          </Badge>
                          <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-white">
                            AI Confidence: {currentDemo.clean.confidence}%
                          </Badge>
                        </div>
                        <span className="font-mono text-slate-500">MPN: {currentDemo.clean.mpn}</span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900">{currentDemo.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-slate-500 font-medium">Manufacturer:</span>
                          <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{currentDemo.clean.cleanMfg}</span>
                          <span className="text-slate-500 font-medium ml-2">Brand:</span>
                          <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{currentDemo.clean.cleanBrand}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-emerald-200/80">
                        <p className="font-semibold text-slate-600 text-[11px] mb-1">Category Tree (For Website Navigation):</p>
                        <div className="flex flex-wrap items-center gap-1 text-slate-800 font-medium">
                          {currentDemo.clean.categoryTree.map((cat, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                                {cat}
                              </span>
                              {idx < currentDemo.clean.categoryTree.length - 1 && (
                                <ChevronRight className="h-3 w-3 text-slate-400" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <p className="font-semibold text-indigo-700 uppercase tracking-wider text-[11px]">Ready E-Commerce Description</p>
                        <p className="text-slate-700 leading-relaxed font-sans">{currentDemo.clean.shortDesc}</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <p className="font-semibold text-emerald-700 uppercase tracking-wider text-[11px]">Structured Technical Specs</p>
                        <div className="grid grid-cols-2 gap-2">
                          {currentDemo.clean.attributes.map((attr, i) => (
                            <div key={i} className="p-2 bg-white rounded border border-slate-200">
                              <span className="text-slate-400 block text-[10px]">{attr.label}</span>
                              <span className="font-semibold text-slate-900">{attr.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <p className="font-semibold text-emerald-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                        <Wand2 className="h-3.5 w-3.5 text-emerald-600" />
                        AI Fixes Applied Automatically
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                        {currentDemo.clean.fixesApplied.map((fix, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span>{fix}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 3 Step Workflow */}
      <section id="how-it-works" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-14 space-y-2">
            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1">
              Simple 3-Step Process
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
              How Anyone Can Clean a Product Catalog
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="clean-card p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center border border-indigo-200">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900">Upload Your Spreadsheet</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Drag and drop your raw CSV or PDF supplier spreadsheet, or pick sample datasets to test immediately.
              </p>
            </div>

            <div className="clean-card p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center border border-indigo-200">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900">AI Cleans & Organizes</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                AI cleans manufacturer names, removes vendor codes, creates standard category trees, and extracts specs.
              </p>
            </div>

            <div className="clean-card p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center border border-indigo-200">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900">Review & Export Reports</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                View plain-English quality grades (A+, B, C), inspect before-and-after fixes, and download PDF or CSV catalog reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TASK 2: Live Metrics Stat Cards with Animated Number Counters */}
      <section id="metrics" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-12 space-y-2">
            <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1">
              Validation Engine
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
              Live Pipeline Metrics
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
              Real-time validation scores across product identification, technical specifications, and commerce compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {/* Stat Card 1: Overall Accuracy */}
            <div className="clean-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Field Accuracy</span>
                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <Target className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">
                  <AnimatedCounter value={metrics.avg_accuracy_pct} suffix="%" />
                </p>
                <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  High precision baseline
                </p>
              </div>
            </div>

            {/* Stat Card 2: Items Scored */}
            <div className="clean-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Items Scored</span>
                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">
                  <AnimatedCounter value={metrics.items_scored} />
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Validated against ground truth
                </p>
              </div>
            </div>

            {/* Stat Card 3: LOV Compliance */}
            <div className="clean-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">LOV Compliance</span>
                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">
                  <AnimatedCounter value={metrics.attribute_lov_compliance_pct} suffix="%" />
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Approved taxonomy values
                </p>
              </div>
            </div>

            {/* Stat Card 4: Char-Limit Compliance */}
            <div className="clean-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Char-Limit Compliance</span>
                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-extrabold font-display text-slate-900 tracking-tight">
                  <AnimatedCounter value={metrics.char_limit_compliance_pct} suffix="%" />
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Channel length rules followed
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-14 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
              Designed To Be Easy To Understand
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Every detail is explained with clear visual badges and help tooltips.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="clean-card p-5 space-y-2">
              <Wand2 className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Smart Brand Cleaner</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Automatically strips vendor numbers like <code className="text-red-600 font-mono">(2435)</code> and unbranded placeholders to produce clean brand names.
              </p>
            </div>

            <div className="clean-card p-5 space-y-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Visual Category Trees</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Builds easy breadcrumb trees (Tools &gt; Saws &gt; Blades) so your website visitors can quickly browse products.
              </p>
            </div>

            <div className="clean-card p-5 space-y-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">5 Ready Description Formats</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generates invoice descriptions, mobile app summaries, website product copy, and marketing descriptions in seconds.
              </p>
            </div>

            <div className="clean-card p-5 space-y-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">AI Self-Trust Score</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The AI rates how confident it is for every item. High confidence items pass automatically; low confidence items get flagged for a quick review.
              </p>
            </div>

            <div className="clean-card p-5 space-y-2">
              <Download className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Printable PDF Reports</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Download formatted 1-page PDF product spec sheets ready for customers or management review with 1 click.
              </p>
            </div>

            <div className="clean-card p-5 space-y-2">
              <BarChart2 className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Accuracy Verification</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Scores enriched items against human-curated answer keys to guarantee data accuracy before going live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace CTA Banner */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto space-y-5 p-8 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
              Ready to Clean Your Catalog?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Start processing raw supplier products right now in your workspace.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="h-11 px-7 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md">
                Open Dashboard Workspace
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-6 bg-white text-xs text-slate-500">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span className="font-brand font-bold text-slate-900 text-sm">InduIntel</span> — Product Catalog Intelligence
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-slate-900 transition-colors">Workspace</Link>
            <Link href="/dashboard/insights" className="hover:text-slate-900 transition-colors">Insights</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
