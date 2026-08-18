'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ChevronRight,
  FileText,
  CheckCircle,
  AlertTriangle,
  Cpu,
  Layers,
  Search,
  ShieldCheck,
  Zap,
  HelpCircle,
  Database,
  BarChart3,
} from 'lucide-react';
import { StatusChip, CircularProgress } from '@/components/ui/status-chip';
import { ClayCard } from '@/components/ui/clay-card';

const DEMO_PRODUCTS = {
  electric_motor: {
    category: 'Industrial Electric Motor',
    name: 'ABB M3BP 160MLA',
    manufacturer: 'ABB Group',
    model: 'M3BP 160MLA 4',
    completeness: 94,
    confidence: 91,
    attributes: [
      { key: 'power', label: 'Rated Power', value: '11.0', unit: 'kW', status: 'VERIFIED', evidence: 'IEC 60034-1 rating table p.4' },
      { key: 'voltage', label: 'Voltage', value: '415', unit: 'V', status: 'VERIFIED', evidence: 'Nameplate specs p.2' },
      { key: 'speed', label: 'Rated Speed', value: '1475', unit: 'RPM', status: 'VERIFIED', evidence: 'Performance curve p.6' },
      { key: 'efficiency_class', label: 'Efficiency Class', value: 'IE3', unit: null, status: 'INFERRED', evidence: 'Efficiency rating table p.8' },
      { key: 'frame_size', label: 'Frame Size', value: '160M', unit: null, status: 'VERIFIED', evidence: 'Dimension drawing p.12' },
    ],
  },
  bearing: {
    category: 'Industrial Bearing',
    name: 'SKF 6210 2Z/C3',
    manufacturer: 'SKF Group',
    model: '6210 2Z/C3',
    completeness: 88,
    confidence: 95,
    attributes: [
      { key: 'bearing_type', label: 'Bearing Type', value: 'Deep Groove Ball', unit: null, status: 'VERIFIED', evidence: 'SKF Catalog 2024 p.18' },
      { key: 'inner_diameter', label: 'Bore Diameter', value: '50.0', unit: 'mm', status: 'VERIFIED', evidence: 'Boundary dimensions p.19' },
      { key: 'outer_diameter', label: 'Outer Diameter', value: '90.0', unit: 'mm', status: 'VERIFIED', evidence: 'Boundary dimensions p.19' },
      { key: 'dynamic_load', label: 'Dynamic Load Rating', value: '37.1', unit: 'kN', status: 'VERIFIED', evidence: 'Load rating tables p.21' },
      { key: 'clearance', label: 'Internal Clearance', value: 'C3 (Greater than Normal)', unit: null, status: 'INFERRED', evidence: 'Designation suffix guide p.5' },
    ],
  },
  industrial_pump: {
    category: 'Industrial Pump',
    name: 'Grundfos CR 15-3',
    manufacturer: 'Grundfos',
    model: 'CR 15-3 A-F-A-E-HQQE',
    completeness: 92,
    confidence: 89,
    attributes: [
      { key: 'pump_type', label: 'Pump Architecture', value: 'Vertical Multistage Centrifugal', unit: null, status: 'VERIFIED', evidence: 'Data booklet p.2' },
      { key: 'flow_rate', label: 'Nominal Flow Rate', value: '15.0', unit: 'm³/h', status: 'VERIFIED', evidence: 'Hydraulic curves p.7' },
      { key: 'head', label: 'Head at Nominal Flow', value: '41.5', unit: 'm', status: 'VERIFIED', evidence: 'Performance chart p.9' },
      { key: 'power', label: 'Motor Power', value: '3.0', unit: 'kW', status: 'VERIFIED', evidence: 'Electrical data p.14' },
      { key: 'inlet_size', label: 'Suction/Discharge Port', value: '50.0', unit: 'mm', status: 'VERIFIED', evidence: 'Flance dimensions p.18' },
    ],
  },
};

export default function LandingPage() {
  const [activeCategory, setActiveCategory] = useState<'electric_motor' | 'bearing' | 'industrial_pump'>('electric_motor');
  const [activeEvidenceAttr, setActiveEvidenceAttr] = useState<any | null>(null);

  const demoProduct = DEMO_PRODUCTS[activeCategory];

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-clay-deep selection:text-text-primary">
      {/* Top Header */}
      <header className="border-b border-clay-deep/30 bg-background/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-heading tracking-tight text-text-primary font-bold">InduIntel</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-widest bg-clay-deep/40 text-text-primary border border-clay-deep/40">
              AI Industrial Platform
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="clay-button-secondary text-sm px-5 py-2.5 hidden sm:inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Live Demo
            </Link>
            <Link href="/dashboard" className="clay-button text-sm px-6 py-2.5 inline-flex items-center gap-2">
              Explore Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-clay-secondary/60 text-xs font-mono text-text-primary border border-clay-deep/30">
                <Sparkles className="w-3.5 h-3.5 text-accent-muted animate-pulse" />
                <span>Zero Hardcoded Data · 100% Explainable Provenance</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-extrabold text-text-primary tracking-tight leading-[1.08]">
                Turn Scattered Technical Documents Into <span className="underline decoration-clay-deep underline-offset-8">Intelligence</span>
              </h1>

              <p className="text-lg md:text-xl text-text-secondary font-sans leading-relaxed">
                InduIntel ingests complex product datasheets, catalogs, and technical manuals to extract schema-compliant specifications, validate cross-source contradictions, and build commerce-ready listings with page-level evidence.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <Link
                  href="/dashboard"
                  className="clay-button text-base px-8 py-4 inline-flex items-center justify-center gap-3 text-center"
                >
                  Start Extraction Pipeline
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#pipeline"
                  className="clay-button-secondary text-base px-6 py-4 inline-flex items-center justify-center gap-2 text-center"
                >
                  <Search className="w-4 h-4" />
                  How It Works
                </a>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-clay-deep/30 text-left">
                <div>
                  <div className="text-2xl md:text-3xl font-heading font-bold text-text-primary">8 Stages</div>
                  <div className="text-xs text-text-secondary font-sans">Automated AI Pipeline</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-heading font-bold text-status-verified">100%</div>
                  <div className="text-xs text-text-secondary font-sans">Page-Level Provenance</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-heading font-bold text-text-primary">3 Categories</div>
                  <div className="text-xs text-text-secondary font-sans">Motors, Bearings & Pumps</div>
                </div>
              </div>
            </motion.div>

            {/* Right Interactive Preview Widget */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="lg:col-span-6"
            >
              <div className="clay-surface p-6 md:p-8 space-y-6 relative overflow-hidden">
                {/* Category Switcher Tabs */}
                <div className="flex items-center gap-2 p-1.5 clay-surface-secondary rounded-xl overflow-x-auto">
                  {(['electric_motor', 'bearing', 'industrial_pump'] as const).map(catKey => (
                    <button
                      key={catKey}
                      onClick={() => setActiveCategory(catKey)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                        activeCategory === catKey
                          ? 'bg-clay-deep text-text-primary shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {catKey.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                {/* Product Summary Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-clay-deep/30">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">Extracted Profile</span>
                    <h3 className="text-2xl font-heading font-bold text-text-primary">{demoProduct.name}</h3>
                    <p className="text-xs text-text-secondary">{demoProduct.manufacturer} · {demoProduct.model}</p>
                  </div>
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <div className="text-2xl font-heading font-bold text-status-verified">{demoProduct.completeness}%</div>
                      <div className="text-[10px] text-text-secondary font-mono uppercase">Completeness</div>
                    </div>
                    <div>
                      <div className="text-2xl font-heading font-bold text-text-primary">{demoProduct.confidence}%</div>
                      <div className="text-[10px] text-text-secondary font-mono uppercase">Confidence</div>
                    </div>
                  </div>
                </div>

                {/* Attributes Extraction List */}
                <div className="space-y-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-text-secondary flex justify-between">
                    <span>Attribute & Value</span>
                    <span>Provenance Status</span>
                  </div>

                  {demoProduct.attributes.map((attr, idx) => (
                    <div
                      key={attr.key}
                      className="clay-surface-sm p-3.5 flex items-center justify-between gap-3 text-sm hover:bg-clay-secondary/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-text-primary">{attr.label}</div>
                        <div className="font-mono text-xs text-text-secondary">
                          {attr.value} {attr.unit || ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusChip status={attr.status as any} size="sm" />
                        <button
                          onClick={() => setActiveEvidenceAttr(attr)}
                          className="px-2 py-1 rounded text-[11px] font-semibold bg-clay-secondary text-text-primary hover:bg-clay-deep transition-all shadow-sm border border-clay-deep/30"
                        >
                          Why?
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Evidence Drawer Modal Preview */}
                <AnimatePresence>
                  {activeEvidenceAttr && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="p-4 bg-clay-deep/20 rounded-xl border border-clay-deep/40 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-text-primary">
                        <span>Evidence Quote for "{activeEvidenceAttr.label}"</span>
                        <button
                          onClick={() => setActiveEvidenceAttr(null)}
                          className="text-text-secondary hover:text-text-primary font-mono text-sm"
                        >
                          ✕
                        </button>
                      </div>
                      <blockquote className="italic text-text-secondary border-l-2 border-clay-deep pl-2">
                        "{activeEvidenceAttr.evidence}"
                      </blockquote>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 8-STAGE PROCESSING PIPELINE SECTION */}
        <section id="pipeline" className="bg-clay/40 py-24 border-y border-clay-deep/30">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">Architecture & Workflow</span>
              <h2 className="text-3xl md:text-5xl font-heading font-bold text-text-primary tracking-tight">
                8-Stage AI Processing Pipeline
              </h2>
              <p className="text-text-secondary font-sans text-lg">
                Every uploaded technical document moves through an automated 8-stage pipeline to ensure zero hallucinations and complete explainability.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: '01', title: 'Upload', desc: 'Ingest PDF, CSV, or text datasheets up to 50MB with instant virus check & hash verification.', icon: FileText },
                { step: '02', title: 'Parse', desc: 'Preserve page-by-page text, table structures, and coordinates for precise evidence linking.', icon: Search },
                { step: '03', title: 'Classify', desc: 'AI automatically identifies category (Electric Motor, Bearing, Pump) and loads required schemas.', icon: Cpu },
                { step: '04', title: 'Extract', desc: 'Extract key specification attributes mapped to canonical schema keys.', icon: Layers },
                { step: '05', title: 'Normalize', desc: 'Convert units (HP → kW, kV → V, mm → m) to standard international units.', icon: Zap },
                { step: '06', title: 'Validate', desc: 'Detect cross-source contradictions and assign severity levels (HIGH, MEDIUM, LOW).', icon: ShieldCheck },
                { step: '07', title: 'Score', desc: 'Compute completeness and application confidence scores based on schema requirements.', icon: BarChart3 },
                { step: '08', title: 'Export', desc: 'Generate commerce-ready descriptions and export standardized JSON & CSV catalogs.', icon: CheckCircle },
              ].map((stage, idx) => (
                <motion.div
                  key={stage.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                >
                  <ClayCard className="p-6 h-full space-y-4 flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-heading font-extrabold text-text-secondary/30">{stage.step}</span>
                        <stage.icon className="w-6 h-6 text-text-secondary" />
                      </div>
                      <h3 className="text-xl font-heading font-bold text-text-primary">{stage.title}</h3>
                      <p className="text-sm text-text-secondary leading-relaxed font-sans">{stage.desc}</p>
                    </div>
                  </ClayCard>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* EXPLAINABILITY & PROVENANCE FEATURE SPOTLIGHT */}
        <section className="py-24 max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6 space-y-6"
            >
              <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">Core Differentiator</span>
              <h2 className="text-3xl md:text-5xl font-heading font-bold text-text-primary tracking-tight leading-tight">
                Explainable Evidence for Every Specification
              </h2>
              <p className="text-text-secondary text-lg leading-relaxed">
                Industrial catalogs require absolute accuracy. InduIntel attaches page numbers, exact datasheet quotes, and confidence scores to every single attribute.
              </p>
              <div className="space-y-4 font-sans text-sm">
                <div className="flex items-start gap-3 p-3 clay-surface-sm">
                  <CheckCircle className="w-5 h-5 text-status-verified flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">VERIFIED Status</strong>
                    <span>Extracted directly from technical tables with matching document evidence.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 clay-surface-sm">
                  <Sparkles className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">INFERRED Intelligence</strong>
                    <span>Logically derived from secondary curves or standard formulas with explicit rationale.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 clay-surface-sm">
                  <AlertTriangle className="w-5 h-5 text-status-conflict flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary block">Conflict Resolution</strong>
                    <span>Flags contradictions across multiple uploaded datasheets with recommended values.</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6"
            >
              <div className="clay-surface p-8 space-y-6 border-l-4 border-status-verified">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-bold text-xl text-text-primary">Attribute Provenance</h3>
                  <StatusChip status="VERIFIED" />
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between font-mono">
                    <span className="text-text-secondary">Attribute Key:</span>
                    <span className="text-text-primary font-bold">power</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-text-secondary">Extracted Value:</span>
                    <span className="text-text-primary font-bold">11.0 kW</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-text-secondary">Confidence Score:</span>
                    <span className="text-status-verified font-bold">98%</span>
                  </div>
                  <div className="pt-3 border-t border-clay-deep/30">
                    <span className="text-xs font-mono uppercase text-text-secondary block mb-1">Source Document & Quote:</span>
                    <div className="p-3 bg-clay-secondary/50 rounded-lg text-xs italic text-text-primary">
                      "Rated power output @ 400V 50Hz: 11 kW according to IEC 60034-1." — ABB_M3BP_Datasheet.pdf, Page 4
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CALL TO ACTION BANNER */}
        <section className="py-20 bg-clay/50 border-t border-clay-deep/30">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-text-primary tracking-tight">
              Ready to Turn Datasheets Into Intelligence?
            </h2>
            <p className="text-text-secondary text-lg max-w-xl mx-auto">
              Ingest your first industrial PDF or CSV document in seconds with zero mock data.
            </p>
            <div className="pt-4">
              <Link href="/dashboard" className="clay-button text-lg px-10 py-5 inline-flex items-center gap-3">
                Open InduIntel Dashboard
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-clay-deep/30 py-10 bg-background">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-secondary">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-text-primary text-sm">InduIntel</span>
            <span>— AI Industrial Product Intelligence</span>
          </div>
          <div>Built for Industrial Commerce, Catalog Teams & Data Management</div>
        </div>
      </footer>
    </div>
  );
}