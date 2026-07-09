'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  MessageSquare, 
  Send, 
  TrendingUp, 
  CheckCircle2, 
  FileText, 
  Sparkles, 
  Play, 
  Layers, 
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple markdown formatter helper for streamed text
function ReportMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split('\n');
  return (
    <div className="space-y-3 text-sm text-slate-300 leading-relaxed max-w-none">
      {lines.map((line, idx) => {
        // H1
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="text-xl font-bold text-white mt-4 mb-2 font-heading">{line.substring(2)}</h1>;
        }
        // H2
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="text-lg font-bold text-slate-100 mt-3 mb-1.5 font-heading">{line.substring(3)}</h2>;
        }
        // H3
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-base font-bold text-slate-200 mt-2 mb-1.5 font-heading">{line.substring(4)}</h3>;
        }
        // Bullet
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={idx} className="ml-4 list-disc pl-1 text-slate-300">{line.substring(2)}</li>;
        }
        // Bold rephrasing
        if (line.includes('**')) {
          const parts = line.split('**');
          return (
            <p key={idx} className="text-slate-300">
              {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-indigo-400 font-semibold">{part}</strong> : part)}
            </p>
          );
        }
        // Empty line
        if (!line.trim()) return <div key={idx} className="h-2" />;

        return <p key={idx} className="text-slate-300">{line}</p>;
      })}
    </div>
  );
}

export default function ReportDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'copywriter' | 'experiments' | 'competitor'>('audit');
  
  // Copilot Chat States
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatId, setChatId] = useState(crypto.randomUUID());
  const [chatOpen, setChatOpen] = useState(true);

  // Clipboard States
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // Screenshot Hover Region Interaction
  const [hoveredProblemIdx, setHoveredProblemIdx] = useState<number | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/history`);
        const result = await res.json();
        const found = result.analyses?.find((a: any) => a.id === id);
        if (found) {
          setData(found);
          // Load chat messages if they exist
          if (found.chats && found.chats.length > 0) {
            setChatMessages(found.chats[0].messages || []);
            setChatId(found.chats[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load report details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePDFExport = async () => {
    setExportingPDF(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AdFit_Report_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('Failed to generate PDF export.');
      }
    } catch (e) {
      console.error(e);
      alert('Error exporting PDF.');
    } finally {
      setExportingPDF(false);
    }
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isChatLoading) return;

    const userMsg = userInput;
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: id,
          chatId,
          message: userMsg
        })
      });

      if (!res.ok) throw new Error('Chat API returned error');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('Readable stream missing');

      // Add temporary assistant block
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let textAccumulator = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        textAccumulator += chunk;

        // Update last message contents
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: textAccumulator };
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Connection timed out. Please check your API settings.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400">Loading CRO Audit Report...</p>
      </div>
    );
  }

  if (!data || !data.report) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <h3 className="text-lg font-bold">Audit Not Found</h3>
        <Link href="/dashboard" className="text-sm text-indigo-400 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  const { report, landingPageUrl, competitorUrl } = data;
  const scoreColor = report.score > 70 ? 'stroke-emerald-500 text-emerald-400' : report.score > 45 ? 'stroke-amber-500 text-amber-400' : 'stroke-red-500 text-red-400';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      
      {/* Top Banner Actions */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="hidden sm:block">
            <div className="text-xs text-slate-500">AdFit Fit Report</div>
            <div className="text-sm font-bold text-slate-200 truncate max-w-xs">{landingPageUrl}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={copyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Share Audit'}</span>
          </button>
          
          <button 
            onClick={handlePDFExport}
            disabled={exportingPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 border border-transparent rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            {exportingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{exportingPDF ? 'Exporting...' : 'Export PDF'}</span>
          </button>

          <button 
            onClick={() => setChatOpen(prev => !prev)}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${chatOpen ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Grid: Left is Report content, Right is Copilot */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* REPORT CONTENT AREA */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
          
          {/* Executive Overview Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Score Ring Card */}
            <div className="glass-panel p-6 rounded-2xl glow-indigo flex flex-col items-center justify-center text-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-heading">Overall Match Score</h3>
              
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background track */}
                  <circle cx="50" cy="50" r="42" strokeWidth="8" stroke="#1e293b" fill="transparent" />
                  {/* Filled track */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="42" 
                    strokeWidth="8" 
                    fill="transparent"
                    className={`transition-all duration-1000 ${scoreColor}`}
                    strokeDasharray="263.8"
                    strokeDashoffset={263.8 - (263.8 * report.score) / 100}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-white font-heading leading-none">{report.score}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold mt-1">out of 100</span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Confidence:</span>
                <span className={`font-semibold ${report.confidence === 'High' ? 'text-emerald-400' : report.confidence === 'Medium' ? 'text-amber-400' : 'text-red-400'}`}>
                  {report.confidence}
                </span>
              </div>
            </div>

            {/* Category Score Grid */}
            <div className="glass-panel p-6 rounded-2xl glow-indigo md:col-span-2 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-heading">Category Alignment Scores</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(report.details).map(([cat, val]: any) => {
                  const barColor = val > 70 ? 'bg-emerald-500' : val > 45 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-400 capitalize">{cat.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-slate-200">{val}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full`} style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Screenshot Preview with Dynamic Highlighting Annotations */}
          {data.screenshotUrl && (
            <div className="glass-panel p-6 rounded-2xl glow-indigo">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 font-heading">Landing Page Screenshot Annotations</h3>
              
              <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
                <img 
                  src={data.screenshotUrl} 
                  alt="Landing Page Viewport"
                  className="w-full h-auto block select-none"
                />

                {/* Overlaid Coordinate Highlight Boxes */}
                {report.problems.map((p: any, idx: number) => {
                  if (!p.region) return null;
                  const isHovered = hoveredProblemIdx === idx;
                  return (
                    <div 
                      key={idx}
                      className={`absolute rounded transition-all duration-300 flex items-center justify-center text-[10px] font-bold ${isHovered ? 'bg-indigo-500/20 border-2 border-indigo-500 text-white shadow-xl shadow-indigo-500/30 opacity-100 z-20 scale-[1.02]' : 'bg-red-500/5 border border-red-500/40 text-red-400 opacity-60 z-10'}`}
                      style={{
                        left: `${p.region.x}%`,
                        top: `${p.region.y}%`,
                        width: `${p.region.width}%`,
                        height: `${p.region.height}%`
                      }}
                      onMouseEnter={() => setHoveredProblemIdx(idx)}
                      onMouseLeave={() => setHoveredProblemIdx(null)}
                    >
                      <span className="px-1.5 py-0.5 bg-slate-950/90 rounded border border-slate-800/80 shadow leading-none font-sans font-normal scale-75 transform origin-center">
                        {p.region.label || `Leak #${idx + 1}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex bg-slate-900/60 border border-slate-900 p-1.5 rounded-xl max-w-md">
            <button
              onClick={() => setActiveTab('audit')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${activeTab === 'audit' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              CRO Fit Audit
            </button>
            <button
              onClick={() => setActiveTab('copywriter')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${activeTab === 'copywriter' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              AI Copywriter
            </button>
            <button
              onClick={() => setActiveTab('experiments')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${activeTab === 'experiments' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              A/B Tests
            </button>
            {competitorUrl && (
              <button
                onClick={() => setActiveTab('competitor')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${activeTab === 'competitor' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Competitor
              </button>
            )}
          </div>

          {/* TAB CONTENTS */}
          <div className="mt-6">
            <AnimatePresence mode="wait">
              {activeTab === 'audit' && (
                <motion.div
                  key="audit-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="space-y-6"
                >
                  {/* Executive Summary Markdown block */}
                  <div className="glass-panel p-6 rounded-2xl glow-indigo space-y-4">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-heading flex items-center gap-2 border-b border-slate-900 pb-3">
                      <FileText className="w-4 h-4" />
                      <span>Executive Summary</span>
                    </h3>
                    <ReportMarkdown text={report.summary} />
                  </div>

                  {/* Prioritized Recommendations list */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-heading px-2">RICE-Prioritized Optimization Checklist</h3>
                    
                    <div className="space-y-3">
                      {report.problems.map((p: any, idx: number) => {
                        const isHovered = hoveredProblemIdx === idx;
                        return (
                          <div 
                            key={idx}
                            onMouseEnter={() => setHoveredProblemIdx(idx)}
                            onMouseLeave={() => setHoveredProblemIdx(null)}
                            className={`glass-panel p-5 rounded-2xl flex flex-col md:flex-row gap-5 items-start transition-all duration-300 ${isHovered ? 'border-indigo-500 bg-slate-900/60' : 'hover:border-slate-800'}`}
                          >
                            {/* Visual RICE priority badge */}
                            <div className="flex flex-row md:flex-col items-center gap-3 shrink-0">
                              <div className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center min-w-[70px] shadow">
                                <div className="text-lg font-black text-indigo-400 leading-none">{p.riceScore}</div>
                                <div className="text-[7px] uppercase tracking-wider text-slate-500 font-semibold mt-1">RICE Score</div>
                              </div>
                              <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold rounded border ${p.priority === 'High' ? 'text-red-400 border-red-500/20 bg-red-500/5' : p.priority === 'Medium' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' : 'text-slate-400 border-slate-800 bg-slate-950'}`}>
                                {p.priority} Priority
                              </span>
                            </div>

                            {/* Recommendations texts */}
                            <div className="space-y-3 flex-1 min-w-0">
                              <div>
                                <h4 className="text-base font-bold text-white leading-tight font-heading">{p.problem}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-500 font-light">
                                  <span>Impact: {p.impact}/10</span>
                                  <span>•</span>
                                  <span>Effort: {p.effort}/10</span>
                                  <span>•</span>
                                  <span>Confidence: {p.confidence}</span>
                                </div>
                              </div>

                              <div className="space-y-2 border-t border-slate-900/60 pt-3 text-xs text-slate-300">
                                <div>
                                  <strong className="text-slate-400">Evidence:</strong> {p.evidence}
                                </div>
                                <div>
                                  <strong className="text-slate-400">Explanation:</strong> {p.explanation}
                                </div>
                                <div>
                                  <strong className="text-slate-400">Business Impact:</strong> {p.businessImpact}
                                </div>
                                <div className="p-3 bg-emerald-950/10 border border-emerald-900/20 rounded-xl mt-2 text-slate-200">
                                  <strong className="text-emerald-400 font-semibold">Suggested Fix:</strong> {p.suggestedFix}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'copywriter' && (
                <motion.div
                  key="copywriter-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="space-y-4"
                >
                  <div className="text-xs text-slate-500 px-2 uppercase font-bold tracking-wide">Suggested Landing Page Copy Revisions</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(report.copywriting).map(([section, text]: any) => (
                      <div key={section} className="glass-panel p-5 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-heading mb-2">{section}</h4>
                          <p className="text-sm text-slate-200 leading-relaxed italic">"{text}"</p>
                        </div>
                        <div className="border-t border-slate-900 pt-3 flex justify-end">
                          <button
                            onClick={() => copyToClipboard(text, section)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-950 border border-slate-900 hover:bg-slate-900 rounded-lg text-[10px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            {copiedSection === section ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedSection === section ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'experiments' && (
                <motion.div
                  key="experiments-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="space-y-4"
                >
                  <div className="text-xs text-slate-500 px-2 uppercase font-bold tracking-wide">Recommended A/B Testing Experiments</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.experiments.map((exp: any, index: number) => (
                      <div key={index} className="glass-panel p-5 rounded-2xl space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs font-bold font-heading">
                            {index + 1}
                          </div>
                          <h4 className="text-sm font-bold text-white font-heading truncate">{exp.hypothesis.slice(0, 45)}...</h4>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed font-light">{exp.hypothesis}</p>

                        <div className="grid grid-cols-2 gap-3 text-[10px] border-t border-slate-900/60 pt-3">
                          <div>
                            <span className="text-slate-500 block uppercase font-bold tracking-wider mb-0.5">Variant A (Control)</span>
                            <span className="text-slate-300 block">{exp.variantA}</span>
                          </div>
                          <div>
                            <span className="text-indigo-400 block uppercase font-bold tracking-wider mb-0.5">Variant B (Challenger)</span>
                            <span className="text-slate-200 block font-semibold">{exp.variantB}</span>
                          </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-900/60 p-3 rounded-xl flex items-center justify-between text-[10px] text-slate-500">
                          <span>Metric: <strong className="text-slate-300 font-semibold">{exp.metric}</strong></span>
                          <span>Duration: <strong className="text-slate-300 font-semibold">{exp.duration}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'competitor' && data.competitor && (
                <motion.div
                  key="competitor-tab"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="space-y-6"
                >
                  <div className="glass-panel p-6 rounded-2xl glow-indigo space-y-4">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-heading flex items-center gap-2 border-b border-slate-900 pb-3">
                      <Layers className="w-4 h-4" />
                      <span>Competitor Comparison Analysis</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="border-l-2 border-indigo-500 pl-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Headline Comparison</h4>
                          <p className="text-xs text-slate-300 mt-1">{data.competitor.headline}</p>
                        </div>
                        <div className="border-l-2 border-indigo-500 pl-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Offer & Value Proposition</h4>
                          <p className="text-xs text-slate-300 mt-1">{data.competitor.offer}</p>
                        </div>
                        <div className="border-l-2 border-indigo-500 pl-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pricing transparency</h4>
                          <p className="text-xs text-slate-300 mt-1">{data.competitor.pricing}</p>
                        </div>
                        <div className="border-l-2 border-indigo-500 pl-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Call-to-Action Mechanics</h4>
                          <p className="text-xs text-slate-300 mt-1">{data.competitor.cta}</p>
                        </div>
                      </div>

                      <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Competitor Strengths</span>
                          <p className="text-xs text-slate-300 mt-1">{data.competitor.strengths}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Competitor Weaknesses</span>
                          <p className="text-xs text-slate-300 mt-1">{data.competitor.weaknesses}</p>
                        </div>
                        <div className="border-t border-slate-900 pt-3">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">How to Outposition Them</span>
                          <p className="text-xs text-slate-200 mt-1 font-semibold">{data.competitor.recommendations}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* AI COPILOT CHAT PANEL (COLLAPSIBLE / SLIDEOUT) */}
        {chatOpen && (
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-900 bg-slate-950 flex flex-col h-[50vh] lg:h-auto shrink-0 relative z-20">
            
            {/* Panel Title */}
            <div className="px-4 py-4 border-b border-slate-900 flex items-center justify-between bg-slate-900/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm text-slate-200 font-heading">AdFit AI Copilot</span>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-slate-950 border border-transparent hover:border-slate-800 rounded text-slate-500 hover:text-slate-300 cursor-pointer lg:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 animate-bounce">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1 font-heading">Ask AdFit Assistant</h4>
                  <p className="text-[10px] text-slate-500 leading-normal max-w-[200px]">
                    "How can I improve CTA conversions?", "Rewrite pricing suggestions", or "What should I test first?"
                  </p>
                </div>
              ) : (
                chatMessages.map((m, idx) => (
                  <div 
                    key={idx}
                    className={`flex flex-col max-w-[85%] rounded-xl p-3 text-xs leading-normal ${m.role === 'user' ? 'bg-slate-900 border border-slate-800/80 text-slate-200 ml-auto' : 'bg-indigo-500/10 border border-indigo-500/10 text-slate-200 mr-auto'}`}
                  >
                    <span className="font-bold text-[8px] uppercase tracking-wider text-slate-500 mb-1 block">
                      {m.role === 'user' ? 'You' : 'AdFit Copilot'}
                    </span>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                ))
              )}
              {isChatLoading && (
                <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/10 text-slate-400 rounded-xl text-xs max-w-[80%]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Generating answer...</span>
                </div>
              )}
            </div>

            {/* Chat input panel */}
            <form onSubmit={sendChatMessage} className="p-4 border-t border-slate-900/60 bg-slate-950">
              <div className="relative">
                <input 
                  type="text" 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Ask a growth question..."
                  disabled={isChatLoading}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-3 pr-10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                />
                <button 
                  type="submit" 
                  disabled={!userInput.trim() || isChatLoading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 text-white rounded-lg disabled:opacity-30 transition-opacity cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
