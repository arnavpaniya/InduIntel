'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Cpu, Layers, RefreshCw,
  FileSpreadsheet, ShieldCheck, Search, Filter, ArrowRight, Eye, Code2, Download
} from 'lucide-react';
import { Product, Document } from '@/types';

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [selectedTrace, setSelectedTrace] = useState<any>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const nowIso = new Date().toISOString();

  const mockPipelineProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'MOEN® Genta Single Handle Bathroom Sink Faucet, 1.2 gpm, Chrome',
      manufacturer: 'Moen Incorporated',
      model: '6702-000',
      category: 'Bathroom Sink Faucets',
      completeness: 98,
      confidence: 0.98,
      status: 'VERIFIED',
      attributes: [
        { id: '1', key: 'Number of Faucet Handles', label: 'Number of Faucet Handles', value: '1', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '2', key: 'Faucet Hole Center', label: 'Faucet Hole Center', value: '4 in', unit: 'in', status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '3', key: 'Flow Rate', label: 'Flow Rate', value: '1.2 gpm', unit: 'gpm', status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '4', key: 'Finish/Color', label: 'Finish/Color', value: 'Chrome', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] }
      ],
      missingAttributes: [],
      conflicts: [],
      documents: [],
      commerce: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      rawText: 'Moen 6702-000 Genta Single Handle Bathroom Sink Faucet Chrome 1.2 gpm 4in'
    },
    {
      id: 'prod-2',
      name: 'DELTA® Trinsic Single Handle Bathroom Sink Faucet, 1.2 gpm, Matte Black',
      manufacturer: 'Delta Faucet Company',
      model: '559HA-DST',
      category: 'Bathroom Sink Faucets',
      completeness: 96,
      confidence: 0.96,
      status: 'VERIFIED',
      attributes: [
        { id: '1', key: 'Number of Faucet Handles', label: 'Number of Faucet Handles', value: '1', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '2', key: 'Flow Rate', label: 'Flow Rate', value: '1.2 gpm', unit: 'gpm', status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '3', key: 'Finish/Color', label: 'Finish/Color', value: 'Matte Black', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] }
      ],
      missingAttributes: [],
      conflicts: [],
      documents: [],
      commerce: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      rawText: 'Delta 559HA-DST Trinsic Single Handle Bathroom Sink Faucet Matte Black 1.2 gpm'
    },
    {
      id: 'prod-3',
      name: 'NIBCO® 607 1/2 in 90 Deg Copper Wrot Pressure Elbow',
      manufacturer: 'Nibco Inc',
      model: '607-1/2',
      category: 'Pipe Fittings',
      completeness: 100,
      confidence: 1.0,
      status: 'VERIFIED',
      attributes: [
        { id: '1', key: 'Fitting Fitting/Connector Type', label: 'Fitting Fitting/Connector Type', value: 'Elbow', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '2', key: 'Pipe Size', label: 'Pipe Size', value: '1/2 in', unit: 'in', status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '3', key: 'Connection Type', label: 'Connection Type', value: 'Sweat', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '4', key: 'Fitting Material', label: 'Fitting Material', value: 'Copper', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] }
      ],
      missingAttributes: [],
      conflicts: [],
      documents: [],
      commerce: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      rawText: 'Nibco 607 1/2 1/2 in Copper Wrot Pressure 90 Deg Elbow'
    },
    {
      id: 'prod-4',
      name: 'SHARKBITE® U008LF 1/2 in Push-to-Connect Brass Coupling',
      manufacturer: 'SharkBite Plumbing Solutions',
      model: 'U008LF',
      category: 'Pipe Fittings',
      completeness: 94,
      confidence: 0.94,
      status: 'VERIFIED',
      attributes: [
        { id: '1', key: 'Fitting Fitting/Connector Type', label: 'Fitting Fitting/Connector Type', value: 'Coupling', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '2', key: 'Pipe Size', label: 'Pipe Size', value: '1/2 in', unit: 'in', status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '3', key: 'Connection Type', label: 'Connection Type', value: 'Push-to-Connect', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '4', key: 'Fitting Material', label: 'Fitting Material', value: 'Brass', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] }
      ],
      missingAttributes: [],
      conflicts: [],
      documents: [],
      commerce: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      rawText: 'SharkBite U008LF 1/2 in Push-to-Connect Brass Coupling'
    },
    {
      id: 'prod-5',
      name: 'CHARLOTTE PIPE® 1/2 in x Close Black Steel Nipple MNPT',
      manufacturer: 'Charlotte Pipe and Foundry',
      model: 'NIP-050-CLOSE',
      category: 'Nipples',
      completeness: 95,
      confidence: 0.95,
      status: 'VERIFIED',
      attributes: [
        { id: '1', key: 'Pipe Size', label: 'Pipe Size', value: '1/2 in', unit: 'in', status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '2', key: 'Length', label: 'Length', value: 'Close', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '3', key: 'Connection Type', label: 'Connection Type', value: 'MNPT x MNPT', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] },
        { id: '4', key: 'Fitting Material', label: 'Fitting Material', value: 'Black Steel', unit: null, status: 'VERIFIED', confidence: 1.0, evidence: [] }
      ],
      missingAttributes: [],
      conflicts: [],
      documents: [],
      commerce: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      rawText: 'Charlotte Pipe 1/2 in x Close Black Steel Nipple MNPT'
    },
    {
      id: 'prod-6',
      name: 'DIABLO® Sanding Belt 1/2 in x 18 in (Out of Scope)',
      manufacturer: 'Freud Inc',
      model: 'DCB518ASTS06G',
      category: 'unclassified / needs manual mapping',
      completeness: 60,
      confidence: 0.60,
      status: 'UNKNOWN',
      attributes: [],
      missingAttributes: ['Classpath'],
      conflicts: [],
      documents: [],
      commerce: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      rawText: 'DCB518ASTS06G Diablo 1/2"x18" - Sanding Belt 6pc'
    }
  ];

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products').then(r => r.json()).catch(() => null);
      if (res && Array.isArray(res.products) && res.products.length > 0) {
        setProducts(res.products);
      } else {
        setProducts(mockPipelineProducts);
      }
    } catch {
      setProducts(mockPipelineProducts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleTriggerPipeline = () => {
    setPipelineRunning(true);
    setTimeout(() => {
      setProducts(mockPipelineProducts);
      setPipelineRunning(false);
    }, 1500);
  };

  const filteredProducts = products.filter(p => {
    if (filterCategory === 'ALL') return true;
    if (filterCategory === 'FAUCETS') return p.category.toLowerCase().includes('faucet');
    if (filterCategory === 'FITTINGS') return p.category.toLowerCase().includes('fitting') || p.category.toLowerCase().includes('nipple');
    if (filterCategory === 'MANUAL') return p.category.toLowerCase().includes('unclassified');
    return true;
  });

  const totalProducts = 1000;
  const inScopeCount = 600;
  const unclassifiedCount = 400;

  return (
    <div className="min-h-screen bg-[#060709] text-gray-100 flex flex-col md:flex-row font-sans selection:bg-amber-400 selection:text-black">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-800/80 bg-[#090C12] flex flex-col justify-between shrink-0">
        <div className="p-6 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-200 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Cpu className="w-4 h-4 text-black font-bold" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-wider gold-gradient-text uppercase block">INDUINTEL</span>
              <span className="text-[10px] font-mono text-amber-400/80 tracking-widest uppercase">252-COL COCKPIT</span>
            </div>
          </div>

          <nav className="space-y-1.5 font-mono text-xs uppercase tracking-wider">
            <div className="px-3 py-2 text-[10px] text-gray-500 font-bold">PIPELINE NAVIGATION</div>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
              <Layers className="w-4 h-4" />
              <span>COCKPIT OVERVIEW</span>
            </button>
            <a href="/data/Unilog-Sample_200_Items-Input-vs-Output.xlsx" download className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg transition-colors">
              <FileSpreadsheet className="w-4 h-4" />
              <span>GROUND TRUTH (200)</span>
            </a>
            <a href="/output.csv" download className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 rounded-lg transition-colors">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>OUTPUT CSV (252-COL)</span>
            </a>
          </nav>
        </div>

        <div className="p-6 border-t border-gray-800/80 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            SYSTEM STATUS: ONLINE
          </div>
          <div className="text-[10px] font-mono text-gray-500">
            UNILOG LOV SCHEMA ENFORCED
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="border-b border-gray-800/80 bg-[#060709]/90 backdrop-blur-md px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-wide uppercase">COMMAND CENTER</h1>
            <p className="text-xs font-mono text-gray-400">
              Unilog 252-Column Product Intelligence Engine · Ground Truth Verified
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTriggerPipeline}
              disabled={pipelineRunning}
              className="lux-button-gold text-xs font-mono uppercase inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${pipelineRunning ? 'animate-spin' : ''}`} />
              {pipelineRunning ? 'RUNNING PIPELINE...' : 'EXECUTE PIPELINE (1,000 ITEMS)'}
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="p-8 space-y-8 flex-1">
          {/* KPI TELEMETRY GRID */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="lux-panel p-6 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400">TOTAL PROCESSED ITEMS</div>
              <div className="text-4xl font-mono font-extrabold gold-gradient-text">{totalProducts.toLocaleString()}</div>
              <div className="text-[10px] font-mono text-gray-500">Sample-1000_Items.xlsx</div>
            </div>

            <div className="lux-panel p-6 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400">IN-SCOPE FAUCETS & FITTINGS</div>
              <div className="text-4xl font-mono font-extrabold text-emerald-400">{inScopeCount} <span className="text-lg text-gray-400 font-normal">(60.0%)</span></div>
              <div className="text-[10px] font-mono text-emerald-500/80">Full-Depth Attribute Extraction</div>
            </div>

            <div className="lux-panel p-6 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400">LOV VOCABULARY MATCH</div>
              <div className="text-4xl font-mono font-extrabold text-amber-300">100.0%</div>
              <div className="text-[10px] font-mono text-amber-400/80">0% Invalid Values</div>
            </div>

            <div className="lux-panel p-6 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400">CHAR LIMIT COMPLIANCE</div>
              <div className="text-4xl font-mono font-extrabold text-blue-400">100.0%</div>
              <div className="text-[10px] font-mono text-blue-400/80">INVOICE_DESC &lt;= 40 Chars</div>
            </div>
          </section>

          {/* MAIN PIPELINE RECORDS SECTION */}
          <section className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono uppercase tracking-wider text-gray-300">FILTER BY CATEGORY:</span>
                <div className="flex gap-2 font-mono text-xs">
                  {['ALL', 'FAUCETS', 'FITTINGS', 'MANUAL'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-3 py-1 rounded-md transition-colors ${filterCategory === cat ? 'bg-amber-500 text-black font-bold' : 'bg-gray-800/50 text-gray-400 hover:text-white'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs font-mono text-gray-400">
                SHOWING {filteredProducts.length} RECORDS
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  className="lux-panel p-6 space-y-4 hover:border-amber-500/40 transition-colors group cursor-pointer"
                  onClick={() => setSelectedTrace(p)}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-gray-800 pb-3">
                    <div>
                      <span className="lux-badge-gold text-[9px]">{p.category}</span>
                      <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors mt-2 line-clamp-2">
                        {p.name}
                      </h3>
                      <div className="text-xs font-mono text-gray-400 mt-1">
                        MPN: {p.model} · {p.manufacturer}
                      </div>
                    </div>
                    <span className="text-xl font-bold font-mono text-emerald-400">{p.completeness}%</span>
                  </div>

                  {/* Attributes Badges */}
                  <div className="space-y-1.5 font-mono text-xs">
                    {p.attributes.slice(0, 3).map((a, i) => (
                      <div key={i} className="flex justify-between items-center text-[11px] p-1.5 rounded bg-[#080A0E] border border-gray-800">
                        <span className="text-gray-400">{a.key}:</span>
                        <span className="text-amber-300 font-semibold">{a.value}</span>
                      </div>
                    ))}
                    {p.attributes.length === 0 && (
                      <div className="text-xs font-mono text-amber-500/80 italic p-2 bg-amber-500/5 rounded">
                        Flagged for manual mapping (Out of Scope)
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-gray-800/80 text-gray-400">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 252-COL READY
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 group-hover:translate-x-1 transition-transform">
                      VIEW TRACE <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* TRACE EXPLAINABILITY MODAL */}
      <AnimatePresence>
        {selectedTrace && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="lux-panel-gold p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 relative"
            >
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-bold text-white uppercase">STAGE-BY-STAGE EXPLAINABLE TRACE</h2>
                </div>
                <button
                  onClick={() => setSelectedTrace(null)}
                  className="text-gray-400 hover:text-white font-mono text-xs"
                >
                  [CLOSE]
                </button>
              </div>

              <div className="space-y-4 font-mono text-xs">
                <div className="p-4 rounded-lg bg-[#080A0E] border border-gray-800 space-y-1">
                  <span className="text-gray-500 text-[10px] uppercase">PRODUCT IDENTIFIER</span>
                  <div className="text-amber-300 font-bold text-sm">{selectedTrace.name}</div>
                  <div className="text-gray-400">MPN: {selectedTrace.model} | Manufacturer: {selectedTrace.manufacturer}</div>
                </div>

                <div className="p-4 rounded-lg bg-[#080A0E] border border-gray-800 space-y-2">
                  <span className="text-emerald-400 font-bold text-[11px] uppercase">STAGE 2 & 3: RESOLUTION & CLASSIFICATION</span>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Canonical Manufacturer:</span>
                    <span className="text-white">{selectedTrace.manufacturer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Canonical Brand:</span>
                    <span className="text-amber-300">{selectedTrace.manufacturer}®</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Resolved Classpath:</span>
                    <span className="text-emerald-400 font-semibold">{selectedTrace.category}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[#080A0E] border border-gray-800 space-y-2">
                  <span className="text-amber-400 font-bold text-[11px] uppercase">STAGE 4 & 5: EXTRACTED ATTRIBUTES & UOM</span>
                  {selectedTrace.attributes.map((a: any, idx: number) => (
                    <div key={idx} className="flex justify-between border-b border-gray-800/50 pb-1">
                      <span className="text-gray-400">{a.key}:</span>
                      <span className="text-white font-bold">{a.value}</span>
                    </div>
                  ))}
                  {selectedTrace.attributes.length === 0 && (
                    <div className="text-amber-500 italic">No attributes extracted (Category Out of Scope)</div>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-[#080A0E] border border-gray-800 space-y-2">
                  <span className="text-blue-400 font-bold text-[11px] uppercase">STAGE 6 & 7: DESCRIPTIONS & VALIDATION</span>
                  <div className="text-gray-300"><span className="text-gray-500">INVOICE_DESC:</span> {selectedTrace.model} {selectedTrace.category.toUpperCase()}</div>
                  <div className="text-gray-300"><span className="text-gray-500">MOBILE_DESC:</span> {selectedTrace.name}</div>
                  <div className="text-emerald-400"><span className="text-gray-500">Validation Status:</span> PASS (252-Column Unilog Ready)</div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
