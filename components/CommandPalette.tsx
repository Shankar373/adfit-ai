'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, BarChart3, Trash2, X, Command } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch reports when command palette is opened
  useEffect(() => {
    if (isOpen) {
      fetch('/api/history')
        .then(res => res.json())
        .then(data => {
          if (data.analyses) setReports(data.analyses);
        })
        .catch(err => console.error('Failed to load history in command palette', err));
      
      // Auto-focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredReports = reports.filter(r => 
    r.landingPageUrl.toLowerCase().includes(search.toLowerCase()) ||
    (r.adCopy && r.adCopy.toLowerCase().includes(search.toLowerCase()))
  );

  const navigateTo = (path: string) => {
    router.push(path);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <>
      {/* Shortcut indicator helper in dashboard bottom */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-full text-xs text-slate-400 cursor-pointer shadow-lg backdrop-blur"
      >
        <Command className="w-3.5 h-3.5" />
        <span>Press</span>
        <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-[10px]">⌘K</kbd>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            {/* Modal Panel */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-lg glass-panel glow-indigo rounded-xl overflow-hidden flex flex-col max-h-[50vh]"
            >
              {/* Search Bar */}
              <div className="flex items-center px-4 border-b border-slate-800/80 py-3 gap-3">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input 
                  ref={inputRef}
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages, ad copy, or quick actions..."
                  className="w-full bg-transparent border-0 outline-none text-sm text-slate-200 placeholder:text-slate-500"
                />
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Suggestions / List */}
              <div className="overflow-y-auto p-2 flex-1">
                {search.length === 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Quick Actions</div>
                    <button 
                      onClick={() => navigateTo('/analyze')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-indigo-500/10 hover:border-l-2 hover:border-indigo-500 rounded text-left transition-colors"
                    >
                      <Plus className="w-4 h-4 text-slate-400" />
                      <span>Start New Analysis</span>
                    </button>
                    <button 
                      onClick={() => navigateTo('/dashboard')}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-indigo-500/10 hover:border-l-2 hover:border-indigo-500 rounded text-left transition-colors"
                    >
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <span>Go to Dashboard</span>
                    </button>
                  </div>
                )}

                <div className="mt-2">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {search.length > 0 ? 'Matching Audits' : 'Recent Audits'}
                  </div>
                  {filteredReports.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-500 text-center">No reports match your search</div>
                  ) : (
                    filteredReports.slice(0, 5).map(r => (
                      <button 
                        key={r.id}
                        onClick={() => navigateTo(`/report/${r.id}`)}
                        className="w-full flex flex-col px-3 py-2 hover:bg-slate-800/60 rounded text-left gap-0.5 transition-colors border border-transparent hover:border-slate-800"
                      >
                        <div className="text-xs font-medium text-slate-200 truncate">{r.landingPageUrl}</div>
                        {r.report && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="text-emerald-400 font-semibold">{r.report.score}/100 Fit</span>
                            <span>•</span>
                            <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
