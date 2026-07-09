'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, BarChart3, ShieldCheck, ArrowRight, Zap, Target, Search, MessageSquare, Files } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="relative flex-1 flex flex-col bg-slate-950 text-slate-50">
      
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[300px] left-1/4 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-[120px] animate-glow" />
        <div className="absolute -top-[200px] right-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/5 blur-[100px] animate-glow" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center font-bold text-slate-950 text-base shadow-lg shadow-indigo-500/20">
            A
          </div>
          <span className="font-semibold text-lg tracking-tight font-heading">AdFit AI</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features" className="hover:text-slate-100 transition-colors">Features</a>
          <a href="#workflow" className="hover:text-slate-100 transition-colors">Workflow</a>
          <a href="#pricing" className="hover:text-slate-100 transition-colors">Pricing</a>
        </nav>

        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            <span>Enter Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-20 pb-16 text-center flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/25 rounded-full text-xs text-indigo-400 font-semibold mb-6 shadow-inner"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Automated Conversion Rate Optimization</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-4xl font-heading"
        >
          Stop losing sales to <span className="bg-gradient-to-r from-indigo-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">Ad-to-Landing Page</span> mismatches.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base sm:text-lg text-slate-400 mb-10 max-w-2xl font-light leading-relaxed"
        >
          Paste your ad copy or upload screenshot, enter your landing page URL, and instantly audit headline alignment, pricing consistency, CTA matches, and run automated A/B experiment flows.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 z-10"
        >
          <button 
            onClick={() => router.push('/analyze')}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl text-base font-semibold shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Analyze Your First Page</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-base font-semibold transition-all cursor-pointer"
          >
            Browse Past Audits
          </button>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 border-t border-slate-900/60">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4 font-heading">Complete CRO Auditing Suite</h2>
          <p className="text-slate-400 text-sm font-light">Built for paid acquisition managers, marketing teams, and growth agencies looking to squeeze every drop of performance out of ad spend.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-xl hover:border-indigo-500/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Playwright Scraping</h3>
            <p className="text-slate-400 text-xs font-light leading-relaxed">
              We spin up browser sandboxes to extract headers, CTAs, testimonials, and trust badges, accurately capturing above-the-fold layout.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-xl hover:border-indigo-500/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Screenshot OCR & Vision</h3>
            <p className="text-slate-400 text-xs font-light leading-relaxed">
              Drag & drop display ads. Our vision model reads headlines, pricing tiers, urgency signals, and maps color palettes for consistency.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-xl hover:border-indigo-500/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">RICE Prioritization</h3>
            <p className="text-slate-400 text-xs font-light leading-relaxed">
              Every copy leak is ranked based on Impact, Confidence, and Effort, giving your developers a clear roadmap for code modifications.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-xl hover:border-indigo-500/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <Files className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">A/B Test Generator</h3>
            <p className="text-slate-400 text-xs font-light leading-relaxed">
              Automatically draft hypotheses, describe variant structures, metrics, necessary traffic sizes, and estimated experiment runtimes.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-xl hover:border-indigo-500/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Interactive Audit Chat</h3>
            <p className="text-slate-400 text-xs font-light leading-relaxed">
              Chat inline with an AI copilot trained specifically on your report context. Ask it to write CSS tweaks or rephrase sections instantly.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-xl hover:border-indigo-500/30 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Competitor Audits</h3>
            <p className="text-slate-400 text-xs font-light leading-relaxed">
              Scan rival landing pages to map pricing models, value positioning, trust badges, and get guidelines on how to beat them.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 mt-auto border-t border-slate-900/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <span>&copy; {new Date().getFullYear()} AdFit AI. All rights reserved.</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-slate-300">Privacy Policy</a>
          <a href="#" className="hover:text-slate-300">Terms of Service</a>
          <a href="#" className="hover:text-slate-300">Contact Support</a>
        </div>
      </footer>
    </div>
  );
}
