'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  UploadCloud, 
  FileText, 
  Link2, 
  Sparkles, 
  BrainCircuit, 
  Compass, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple markdown formatter helper for streamed text
function StreamedMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-sm text-slate-300 leading-relaxed max-w-none">
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

export default function NewAnalysis() {
  const router = useRouter();
  const [adCopy, setAdCopy] = useState('');
  const [landingPageUrl, setLandingPageUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [dragActive, setDragActive] = useState(false);

  // Streaming Analysis States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [streamedSummary, setStreamedSummary] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG).');
      return;
    }

    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setScreenshotBase64(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingPageUrl) return;

    setIsAnalyzing(true);
    setCurrentStatus('Scraping page and establishing secure connection...');
    setStreamedSummary('');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adCopy: adCopy || undefined,
          screenshotUrl: screenshotBase64 || undefined,
          landingPageUrl,
          competitorUrl: competitorUrl || undefined,
          provider
        })
      });

      if (!response.ok) {
        throw new Error('Analysis request failed. Please check your inputs.');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No readable stream available');

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        
        // Save the last partial event back to buffer
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;

          // Parse event name and JSON data
          const lines = event.split('\n');
          let eventType = 'message';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.substring(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.substring(6).trim();
            }
          }

          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              if (eventType === 'progress') {
                setCurrentStatus(data.status);
                if (data.chunk) {
                  setStreamedSummary(prev => prev + data.chunk);
                }
              } else if (eventType === 'complete') {
                setCurrentStatus('Completed! Saving analysis to dashboard.');
                // Redirect on success
                setTimeout(() => {
                  router.push(`/report/${data.id}`);
                }, 1000);
              } else if (eventType === 'error') {
                setErrorMessage(data.message || 'An unexpected analysis error occurred.');
                setIsAnalyzing(false);
              }
            } catch (err) {
              console.error('Failed to parse SSE JSON', err, dataStr);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Connection failed:', err);
      setErrorMessage(err.message || 'Failed to establish connection. Check your local API variables.');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-20">
      
      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[200px] right-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[100px] animate-glow" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-4xl mx-auto px-6 py-6 flex items-center gap-4">
        <Link href="/dashboard" className="p-2 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white font-heading">New Fit Analysis</h1>
          <p className="text-xs text-slate-500">Run audit between advertisement materials and landing pages</p>
        </div>
      </header>

      {/* Content body */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-6 mt-6 flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {!isAnalyzing ? (
            /* Analysis Input Form */
            <motion.form 
              key="input-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={triggerAnalyze}
              className="space-y-6 flex-1 flex flex-col justify-between"
            >
              <div className="space-y-6">
                
                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl flex items-start gap-3 text-sm text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold">Analysis Failed</h4>
                      <p className="text-xs text-red-400/80 mt-1">{errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* AD DETAILS BLOCK */}
                <div className="glass-panel p-5 rounded-2xl glow-indigo space-y-4">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-heading flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Step 1: Advertisement Content</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Copy Input */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-400">Ad Copy (Text)</label>
                      <textarea
                        value={adCopy}
                        onChange={(e) => setAdCopy(e.target.value)}
                        placeholder="Paste headlines, body descriptions, hooks, or core offers here..."
                        className="flex-1 min-h-[140px] bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
                      />
                    </div>

                    {/* Screenshot drag-and-drop */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-400">Or Upload Ad Screenshot</label>
                      <div 
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`flex-1 min-h-[140px] border border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center transition-all ${dragActive ? 'border-indigo-500 bg-indigo-500/5' : screenshotBase64 ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'}`}
                      >
                        <input 
                          type="file" 
                          id="file-upload" 
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden" 
                        />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                          <UploadCloud className={`w-8 h-8 ${screenshotBase64 ? 'text-emerald-400' : 'text-slate-500'}`} />
                          <div className="text-xs font-semibold text-slate-300">
                            {screenshotName ? screenshotName : 'Drag & drop image, or browse'}
                          </div>
                          <div className="text-[10px] text-slate-500">Supports PNG, JPG, JPEG</div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TARGET LANDING PAGE DETAILS */}
                <div className="glass-panel p-5 rounded-2xl glow-indigo space-y-4">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-heading flex items-center gap-2">
                    <Compass className="w-4 h-4" />
                    <span>Step 2: Conversion Channels</span>
                  </h3>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Landing Page URL</span>
                      </label>
                      <input
                        type="url"
                        value={landingPageUrl}
                        onChange={(e) => setLandingPageUrl(e.target.value)}
                        placeholder="https://yourproduct.com/landing-page"
                        required
                        className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Competitor Landing Page URL (Optional)</span>
                      </label>
                      <input
                        type="url"
                        value={competitorUrl}
                        onChange={(e) => setCompetitorUrl(e.target.value)}
                        placeholder="https://competitor.com/landing-page"
                        className="w-full bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* AI SETTINGS */}
                <div className="glass-panel p-5 rounded-2xl glow-indigo flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <BrainCircuit className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-200 font-heading">Multi-LLM Orchestration</h4>
                      <p className="text-[10px] text-slate-500 font-light">Select the core cognitive model to scan alignment</p>
                    </div>
                  </div>

                  <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setProvider('openai')}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${provider === 'openai' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      OpenAI (GPT-4o)
                    </button>
                    <button
                      type="button"
                      onClick={() => setProvider('anthropic')}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${provider === 'anthropic' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Anthropic (Claude 3.5)
                    </button>
                  </div>
                </div>

              </div>

              {/* Submit buttons */}
              <div className="mt-8 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={!landingPageUrl}
                  className="w-full md:w-auto px-8 py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-slate-900 disabled:to-slate-900 disabled:border-slate-800 disabled:text-slate-600 border border-transparent text-white font-semibold rounded-xl transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Run Fit Analysis</span>
                </button>
              </div>
            </motion.form>
          ) : (
            /* STREAMING PROGRESS DASHBOARD */
            <motion.div 
              key="progress-stream"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col gap-6"
            >
              {/* Spinner & Phase Indicator */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center glow-indigo py-10">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-white mb-2 font-heading">{currentStatus}</h3>
                <p className="text-xs text-slate-400 font-light max-w-md">
                  We are parsing DOM layouts, taking snapshots, and comparing messaging variables. This usually takes 15-30 seconds.
                </p>

                {/* Custom glowing progress bar */}
                <div className="w-full max-w-md h-1.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden mt-6">
                  <motion.div 
                    initial={{ width: '10%' }}
                    animate={{ width: ['20%', '45%', '70%', '95%'] }}
                    transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full"
                  />
                </div>
              </div>

              {/* Streaming Output Box */}
              {streamedSummary && (
                <div className="flex-1 flex flex-col min-h-[300px]">
                  <div className="px-4 py-2 border border-slate-800/80 border-b-0 rounded-t-2xl bg-slate-900/40 text-xs font-bold text-slate-400 tracking-wide flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      <span>STREAMING CRO EXECUTIVE SUMMARY</span>
                    </div>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  </div>

                  <div className="flex-1 glass-panel border-t-0 p-6 rounded-b-2xl max-h-[45vh] overflow-y-auto glow-indigo">
                    <StreamedMarkdown text={streamedSummary} />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
