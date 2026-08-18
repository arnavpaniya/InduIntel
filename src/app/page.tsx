'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, FileText, CheckCircle, ShieldCheck, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-text-primary font-sans flex flex-col justify-between selection:bg-accent selection:text-background">
      {/* Top Header */}
      <header className="border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-mono font-bold tracking-wider uppercase text-text-primary">INDUINTEL</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest bg-surface-raised text-accent border border-border">
              v2.0 Command-Center
            </span>
          </div>

          <Link href="/dashboard" className="clay-button text-sm inline-flex items-center gap-2">
            ENTER DASHBOARD
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="max-w-5xl mx-auto px-6 py-24 md:py-32 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="text-xs font-mono tracking-widest text-text-secondary uppercase">
              INDUSTRIAL PRODUCT DATA CONTROL ROOM
            </div>

            <h1 className="text-4xl sm:text-6xl font-sans font-medium tracking-tight text-text-primary leading-tight max-w-4xl mx-auto">
              Turn scattered product data into intelligence.
            </h1>

            <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto font-sans leading-relaxed">
              AI-powered extraction, validation, and explainable product intelligence for industrial commerce.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="clay-button text-sm px-8 py-3.5 inline-flex items-center gap-2"
              >
                ENTER DASHBOARD
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Live System Status Strip */}
            <div className="pt-2 text-xs font-mono text-text-muted uppercase tracking-wider">
              SYSTEM READY · GEMINI CONNECTED · 0 CONFLICTS PENDING
            </div>
          </motion.div>

          {/* Floating Product Intelligence Panel */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="pt-8 max-w-md mx-auto text-left"
          >
            <div className="command-panel p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border-divider pb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-text-secondary">
                  PRODUCT INTELLIGENCE
                </span>
                <span className="text-xs font-mono text-status-verified">● ACTIVE</span>
              </div>
              <div className="text-lg font-mono font-medium text-text-primary">
                MOTOR M3BP 160MLA
              </div>
              <div className="space-y-2 font-mono text-xs pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">COMPLETENESS</span>
                  <span className="text-status-verified font-bold">94%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">CONFIDENCE</span>
                  <span className="text-text-primary font-bold">91%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">CONFLICTS</span>
                  <span className="text-status-conflict font-bold">02</span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* SECTION 2 — HOW IT WORKS */}
        <section className="border-y border-border bg-surface py-20">
          <div className="max-w-6xl mx-auto px-6 space-y-12">
            <div className="text-center space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-text-secondary">PIPELINE WORKFLOW</span>
              <h2 className="text-2xl font-sans font-medium text-text-primary">Control Room Operations</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  num: '01',
                  title: 'IMPORT',
                  desc: 'Upload PDF, CSV, or TXT datasheets. Immutable page-level parser preserves exact source coordinates.',
                },
                {
                  num: '02',
                  title: 'UNDERSTAND',
                  desc: 'Gemini AI classifies product categories & extracts structured specifications mapped to schema definitions.',
                },
                {
                  num: '03',
                  title: 'VALIDATE',
                  desc: 'Deterministic TypeScript engines normalize units, score completeness, and flag competing values for review.',
                },
              ].map((step) => (
                <div key={step.num} className="command-panel p-6 space-y-4">
                  <div className="text-2xl font-mono font-bold text-accent">{step.num}</div>
                  <h3 className="text-base font-sans font-medium text-text-primary uppercase tracking-wider">{step.title}</h3>
                  <p className="text-sm font-sans text-text-secondary leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3 — CLOSING CTA */}
        <section className="py-24 max-w-4xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl font-sans font-medium text-text-primary tracking-tight">
            Your product data. Understood.
          </h2>
          <div className="pt-2">
            <Link href="/dashboard" className="clay-button text-sm px-8 py-3.5 inline-flex items-center gap-2">
              OPEN INDUINTEL
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 bg-background text-xs font-mono text-text-muted text-center">
        INDUINTEL v2.0 · DARK INDUSTRIAL COMMAND-CENTER
      </footer>
    </div>
  );
}