'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Trash2, 
  Copy, 
  ExternalLink, 
  TrendingUp, 
  Activity, 
  AlertTriangle, 
  Layers, 
  ChevronRight, 
  Sparkles,
  Command
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CommandPalette from '@/components/CommandPalette';

export default function Dashboard() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const router = useRouter();

  const loadData = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.analyses) {
        setAnalyses(data.analyses);
        setStats(data.stats);
        setIsDemoMode(!!data.isDemoMode);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this analysis?')) return;
    
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Optimistic delete
        setAnalyses(prev => prev.filter(a => a.id !== id));
        loadData(); // reload stats
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id })
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error('Duplicate failed', err);
    }
  };

  const filteredAnalyses = analyses.filter(a => 
    a.landingPageUrl.toLowerCase().includes(search.toLowerCase()) ||
    (a.adCopy && a.adCopy.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-950 text-slate-100 pb-20">
      
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[200px] left-1/3 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 flex items-center justify-between border-b border-slate-900/60">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center font-bold text-slate-950 text-base shadow shadow-indigo-500/20">
            A
          </Link>
          <span className="font-semibold text-lg tracking-tight font-heading">AdFit AI</span>
          {isDemoMode ? (
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] rounded-full font-semibold animate-pulse shadow-sm shadow-amber-500/10">Demo Mode</span>
          ) : (
            <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] rounded-full font-semibold">Live Mode</span>
          )}
        </div>

        <Link 
          href="/analyze"
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Analysis</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-6 mt-10 flex-1 flex flex-col">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          
          <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Average Fit Score</div>
              <div className="text-3xl font-extrabold text-white font-heading">
                {loading ? '-' : stats?.averageScore ? `${stats.averageScore}%` : '0%'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Total Audits Run</div>
              <div className="text-3xl font-extrabold text-white font-heading">
                {loading ? '-' : stats?.totalAnalyses || 0}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Issues Identified</div>
              <div className="text-3xl font-extrabold text-white font-heading">
                {loading ? '-' : Object.values(stats?.commonIssuesCount || {}).reduce((a: any, b: any) => a + b, 0) as number}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Competitor Scans</div>
              <div className="text-3xl font-extrabold text-white font-heading">
                {loading ? '-' : analyses.filter(a => a.competitorUrl).length}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search previous audits by target landing page or ad copy..."
              className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-panel p-5 rounded-xl flex items-center justify-between animate-pulse">
                <div className="flex flex-col gap-2 w-1/2">
                  <div className="h-4 bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-800/60 rounded w-1/2" />
                </div>
                <div className="h-10 w-10 bg-slate-800 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filteredAnalyses.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl py-20 px-6 text-center glass-panel">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">No analyses found</h3>
            <p className="text-slate-400 text-xs font-light max-w-sm mb-8">
              {search ? "No audits match your current query. Try searching for a different URL." : "Start checking conversions by running your first ad-to-landing page alignment audit today."}
            </p>
            {!search && (
              <Link 
                href="/analyze"
                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Audit</span>
              </Link>
            )}
          </div>
        ) : (
          /* Report List */
          <div className="flex flex-col gap-3">
            <AnimatePresence>
              {filteredAnalyses.map((a, index) => {
                const score = a.report?.score || 0;
                const scoreColor = score > 70 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : score > 45 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20';

                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    onClick={() => router.push(`/report/${a.id}`)}
                    className="group glass-panel p-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 hover:bg-slate-900/40 transition-all cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-bold text-slate-200 truncate block max-w-md">{a.landingPageUrl}</span>
                        <a 
                          href={a.landingPageUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      
                      {a.adCopy && (
                        <p className="text-xs text-slate-400 font-light truncate mb-2 max-w-xl italic">
                          Ad Copy: "{a.adCopy}"
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span>Scanned {new Date(a.createdAt).toLocaleDateString()}</span>
                        {a.competitorUrl && (
                          <>
                            <span>•</span>
                            <span className="text-cyan-400 font-medium">Competitor audit active</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-900/60">
                      {a.report && (
                        <div className={`px-3 py-1.5 rounded-lg border text-center ${scoreColor}`}>
                          <div className="text-lg font-extrabold leading-none">{score}</div>
                          <div className="text-[8px] uppercase tracking-wider font-semibold mt-0.5">Fit Score</div>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDuplicate(a.id, e)}
                          title="Duplicate Audit"
                          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors border border-transparent hover:border-slate-800 cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(a.id, e)}
                          title="Delete Audit"
                          className="p-2 hover:bg-red-950/20 hover:border-red-900/30 rounded-lg text-slate-400 hover:text-red-400 transition-colors border border-transparent cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="p-1.5 text-slate-600 group-hover:text-slate-400 transition-colors hidden md:block">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Command Palette Hook */}
      <CommandPalette />
    </div>
  );
}
