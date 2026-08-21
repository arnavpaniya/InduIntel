'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { 
  Zap, ArrowRight, ChevronRight, Target, CheckCircle2, 
  FileText, Layers, Package, TrendingUp,
  AlertTriangle, Shield, Sparkles, Wand2, ArrowUpRight,
  Sliders, Eye, Check, X, FileSpreadsheet, Download, RefreshCw, BarChart2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Sample demo datasets for the interactive landing page simulator
const DEMO_TRANSFORMATIONS = [
  {
    id: 'tool-1',
    name: 'Industrial Circular Saw Blade',
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
      qualityGrade: 'A+ (100% Ready to Sell)',
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
        'Cleaned manufacturer name (Removed vendor codes 2435)',
        'Resolved brand to Freud Diablo',
        'Auto-assigned 4-level category taxonomy tree',
        'Extracted 4 standardized technical attributes',
        'Generated 5 audience-specific descriptions'
      ]
    }
  },
  {
    id: 'fastener-1',
    name: 'Heavy Duty Structural Hex Bolt',
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
      qualityGrade: 'A (Fully Validated)',
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

export default function LandingPage() {
  const [selectedDemoIndex, setSelectedDemoIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'raw' | 'clean'>('clean');

  const currentDemo = DEMO_TRANSFORMATIONS[selectedDemoIndex];

  return (
    <div className="app-shell min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      {/* Top Header Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Zap className="h-5 w-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-display">InduIntel</span>
                <Badge variant="outline" className="border-indigo-500/40 bg-indigo-500/10 text-indigo-300 text-[10px] uppercase tracking-wider">
                  Catalog AI 2.5
                </Badge>
              </div>
              <p className="text-xs text-slate-400">AI Product Intelligence & Catalog Cleaner</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#demo" className="hover:text-white transition-colors">Live Interactive Demo</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <Link href="/dashboard/insights" className="hover:text-white transition-colors flex items-center gap-1">
              <BarChart2 className="h-4 w-4 text-emerald-400" />
              <span>Insights</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30 gap-2 font-medium">
                <Sparkles className="h-4 w-4" />
                Open Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 lg:py-24 border-b border-slate-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))]" />
        
        <div className="container relative mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center space-y-6">
            {/* Pill Header */}
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300 shadow-inner">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Designed for Non-Technical Users & Catalog Managers</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl font-display leading-tight">
              Turn Messy Supplier Sheets into <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Clean, Ready-to-Sell Product Catalogs
              </span>
            </h1>

            {/* Plain English Subtitle */}
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-300/90 leading-relaxed font-sans">
              Industrial products arrive from suppliers with broken brand names, missing sizes, and messy codes. 
              <strong className="text-white font-semibold"> InduIntel uses AI to fix brands, organize items into clear category trees, write ready descriptions, and verify accuracy</strong> — so anyone can understand and publish them instantly.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:opacity-95 text-white font-semibold shadow-xl shadow-indigo-500/30 gap-2">
                  <Zap className="h-5 w-5 fill-white" />
                  Try Workspace Now
                </Button>
              </Link>
              <a href="#demo">
                <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-7 text-base border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white gap-2">
                  <Eye className="h-5 w-5 text-indigo-400" />
                  See Live Interactive Demo
                </Button>
              </a>
            </div>

            {/* Trust Points */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Zero Technical Jargon</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
                <Shield className="h-4 w-4 text-indigo-400" />
                <span>Human-in-the-Loop Quality Checks</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
                <FileSpreadsheet className="h-4 w-4 text-purple-400" />
                <span>Instant CSV & PDF Reports</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Before/After Simulator Section */}
      <section id="demo" className="py-16 lg:py-24 bg-slate-900/50 relative border-b border-slate-800/80">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-10 space-y-3">
            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 px-3 py-1">
              Interactive Product Transformer
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
              See How Messy Supplier Data Turns Into Clear Catalog Data
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Click between the raw supplier feed and the AI-cleaned catalog view below to experience the transformation.
            </p>
          </div>

          {/* Simulator Box */}
          <div className="max-w-5xl mx-auto bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            {/* Control Bar */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Product Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sample Item:</span>
                <div className="flex items-center gap-2">
                  {DEMO_TRANSFORMATIONS.map((demo, idx) => (
                    <button
                      key={demo.id}
                      onClick={() => setSelectedDemoIndex(idx)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border',
                        selectedDemoIndex === idx
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                      )}
                    >
                      <span>{demo.categoryIcon}</span>
                      <span>{demo.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setViewMode('raw')}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2',
                    viewMode === 'raw'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <X className="h-3.5 w-3.5 text-red-400" />
                  <span>Before: Raw Supplier Data</span>
                </button>
                <button
                  onClick={() => setViewMode('clean')}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2',
                    viewMode === 'clean'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>After: AI Clean Catalog</span>
                </button>
              </div>
            </div>

            {/* Display Body */}
            <div className="p-6 sm:p-8">
              <AnimatePresence mode="wait">
                {viewMode === 'raw' ? (
                  <motion.div
                    key="raw-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="destructive" className="text-xs">Messy Supplier Record</Badge>
                        <span className="font-mono text-xs text-red-400">MPN: {currentDemo.raw.mpn}</span>
                      </div>
                      <p className="font-mono text-base font-semibold text-red-200">{currentDemo.raw.rawDesc}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Raw Supplier Brands</p>
                        <div className="space-y-1.5 text-sm font-mono text-slate-300">
                          <p><span className="text-slate-500">E1 Feed:</span> <span className="text-red-400">{currentDemo.raw.e1Brand}</span></p>
                          <p><span className="text-slate-500">Unilog Feed:</span> <span className="text-red-400">{currentDemo.raw.unilogBrand}</span></p>
                          <p><span className="text-slate-500">DIB Feed:</span> <span className="text-red-400">{currentDemo.raw.dibBrand}</span></p>
                          <p><span className="text-slate-500">Manufacturer Field:</span> <span className="text-red-400">{currentDemo.raw.mfgField}</span></p>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">What&apos;s Wrong With This Data?</p>
                        <ul className="space-y-1.5 text-xs text-red-300">
                          {currentDemo.raw.issues.map((issue, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
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
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Header Card */}
                    <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-emerald-500/40 rounded-xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                            {currentDemo.clean.qualityGrade}
                          </Badge>
                          <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 text-xs">
                            AI Trust Score: {currentDemo.clean.confidence}%
                          </Badge>
                        </div>
                        <span className="font-mono text-xs text-slate-400">MPN: {currentDemo.clean.mpn}</span>
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-white">{currentDemo.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-xs text-slate-400 font-medium">Manufacturer:</span>
                          <Badge variant="secondary" className="bg-slate-800 text-slate-200 font-medium">{currentDemo.clean.cleanMfg}</Badge>
                          <span className="text-xs text-slate-400 font-medium ml-2">Brand:</span>
                          <Badge variant="secondary" className="bg-slate-800 text-slate-200 font-medium">{currentDemo.clean.cleanBrand}</Badge>
                        </div>
                      </div>

                      {/* Visual Category Tree */}
                      <div className="pt-2 border-t border-slate-800/80">
                        <p className="text-xs font-medium text-slate-400 mb-1.5">Category Breadcrumb Tree (For Website Navigation):</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 font-medium">
                          {currentDemo.clean.categoryTree.map((cat, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <span className="bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-md border border-indigo-500/30">
                                {cat}
                              </span>
                              {idx < currentDemo.clean.categoryTree.length - 1 && (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Features & Specs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Short Description */}
                      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                        <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider">Ready E-Commerce Description</p>
                        <p className="text-sm text-slate-200 leading-relaxed font-sans">{currentDemo.clean.shortDesc}</p>
                        <div className="pt-2 flex items-center gap-2 text-xs text-slate-400">
                          <Badge variant="outline" className="text-[10px] border-slate-700">Invoice: {currentDemo.clean.invoiceDesc}</Badge>
                        </div>
                      </div>

                      {/* Extracted Attributes */}
                      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                        <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Structured Technical Specs</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {currentDemo.clean.attributes.map((attr, i) => (
                            <div key={i} className="p-2 bg-slate-950 rounded border border-slate-800/80">
                              <span className="text-slate-400 block">{attr.label}</span>
                              <span className="font-semibold text-slate-200">{attr.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* AI Fixes Applied */}
                    <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl">
                      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Wand2 className="h-3.5 w-3.5" />
                        Automated AI Improvements Applied
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                        {currentDemo.clean.fixesApplied.map((fix, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>{fix}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Simple Process */}
      <section id="how-it-works" className="py-16 lg:py-24 border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-3">
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 px-3 py-1">
              Easy 3-Step Workflow
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
              How Anyone Can Clean a Product Catalog in Minutes
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              No complex database scripts or technical training required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="p-6 bg-slate-900/80 rounded-2xl border border-slate-800 relative space-y-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                1
              </div>
              <h3 className="text-xl font-bold text-white">Upload Your Supplier File</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Drag and drop your raw CSV or PDF supplier spreadsheet, or choose from built-in sample datasets to get started instantly.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 bg-slate-900/80 rounded-2xl border border-slate-800 relative space-y-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-lg">
                2
              </div>
              <h3 className="text-xl font-bold text-white">AI Cleans & Organizes</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Gemini AI cleans manufacturer names, removes junk vendor codes, organizes products into visual category trees, and extracts specs.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 bg-slate-900/80 rounded-2xl border border-slate-800 relative space-y-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
                3
              </div>
              <h3 className="text-xl font-bold text-white">Review & Export Reports</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                View plain-English quality grades (A+, B, C), check before-and-after fixes, and download printable PDF or CSV catalog reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Non-Technical Features Grid */}
      <section id="features" className="py-16 lg:py-24 bg-slate-900/30 border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16 space-y-3">
            <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/30 px-3 py-1">
              Built For Everyone
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
              Designed To Be Easy To Understand
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Every detail is explained in simple terms with visual badges and help tooltips.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Wand2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Smart Brand Cleaner</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Automatically strips vendor numbers like <code className="text-red-400 font-mono">(2435)</code> and unbranded placeholders to produce clean brand names.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Visual Category Trees</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Builds easy breadcrumb trees (Tools &gt; Saws &gt; Blades) so your website visitors can quickly browse products.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">5 Ready Description Formats</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Generates invoice descriptions, mobile app summaries, website product copy, and marketing descriptions in seconds.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">AI Self-Trust Score</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                The AI rates how confident it is for every item. High confidence items pass automatically; low confidence items get flagged for a quick review.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Printable PDF Reports</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Download formatted 1-page PDF product spec sheets ready for customers or management review with 1 click.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Accuracy Verification</h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Scores enriched items against human-curated answer keys to guarantee data accuracy before going live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-20 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="max-w-3xl mx-auto space-y-6 p-10 rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/30 shadow-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white font-display">
              Ready to Clean Your Product Catalog?
            </h2>
            <p className="text-slate-300 text-base">
              Start processing raw products right now in your workspace.
            </p>
            <Link href="/dashboard">
              <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-xl shadow-indigo-500/30 gap-2">
                <Zap className="h-5 w-5 fill-white" />
                Go to Dashboard Workspace
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-800 bg-slate-950 text-xs text-slate-400">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            <span className="font-bold text-slate-200">InduIntel</span>
            <span>— AI Product Intelligence Pipeline</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link href="/dashboard/insights" className="hover:text-white transition-colors">Insights</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
