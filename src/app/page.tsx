'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ChevronRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-clay-deep/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-text-primary tracking-tight">InduIntel</div>
          <Link href="/dashboard" className="clay-button hidden md:inline-flex">
            Explore Dashboard
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-6 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-bold text-text-primary tracking-tight leading-tight mb-6">
              INDUINTEL
            </h1>
            <p className="text-xl md:text-2xl text-text-secondary mb-8 max-w-2xl mx-auto leading-relaxed">
              Turn scattered product data into intelligence.
            </p>
            <p className="text-lg text-text-secondary mb-10 max-w-2xl mx-auto">
              AI-powered product enrichment, validation and explainable intelligence for industrial commerce.
            </p>
            <Link href="/dashboard" className="inline-flex items-center gap-3 clay-button text-lg px-8 py-4">
              Explore Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-20"
          >
            <div className="clay-surface p-6 md:p-8 max-w-md mx-auto">
              <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
                PRODUCT INTELLIGENCE
              </div>
              <div className="text-xl font-bold text-text-primary mb-2">ABB M3BP 160MLA</div>
              <div className="text-text-secondary mb-6">Industrial Electric Motor</div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold text-status-verified">94%</div>
                  <div className="text-xs text-text-secondary">Completeness</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-text-primary">91%</div>
                  <div className="text-xs text-text-secondary">Confidence</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-status-conflict">02</div>
                  <div className="text-xs text-text-secondary">Conflicts</div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="bg-clay/50 py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">How It Works</h2>
              <p className="text-text-secondary max-w-2xl mx-auto">Three steps to turn documents into intelligence.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                {
                  number: '01',
                  title: 'IMPORT',
                  description: 'Upload documents',
                  icon: Sparkles,
                },
                {
                  number: '02',
                  title: 'UNDERSTAND',
                  description: 'AI extracts product data',
                  icon: ArrowRight,
                },
                {
                  number: '03',
                  title: 'INTELLIGENCE',
                  description: 'Validate, enrich & explain',
                  icon: ChevronRight,
                },
              ].map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="clay-surface p-8 text-center"
                >
                  <div className="text-4xl font-bold text-text-secondary/30 mb-4">{step.number}</div>
                  <step.icon className="w-10 h-10 mx-auto mb-4 text-text-secondary" />
                  <h3 className="text-xl font-bold text-text-primary mb-2">{step.title}</h3>
                  <p className="text-text-secondary">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
                Your product data.<br />Understood.
              </h2>
              <Link href="/dashboard" className="inline-flex items-center gap-3 clay-button text-lg px-8 py-4 mt-6">
                Open InduIntel
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-clay-deep/30 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-text-secondary text-sm">
          InduIntel — AI-powered industrial product intelligence
        </div>
      </footer>
    </div>
  );
}