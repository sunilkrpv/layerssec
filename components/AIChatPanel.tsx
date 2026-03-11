'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, X, ScanSearch, Lock, ShieldAlert, Save, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/lib/themeContext';
import ThreatResultCard from '@/components/ThreatResultCard';
import ThreatHistoryPanel from '@/components/ThreatHistoryPanel';
import type { ThreatItem } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  threatResults?: ThreatItem[];
}

interface AIChatPanelProps {
  onGenerate: (prompt: string) => Promise<void>;
  onGenerateNewLayer: (prompt: string, layerName: string) => Promise<void>;
  /** Full evaluation or Q&A — pass optional question for Q&A mode */
  onEvaluate?: (onChunk: (chunk: string) => void, question?: string) => Promise<void>;
  /** Run STRIDE threat analysis — returns transient ThreatItems */
  onThreatAnalysis?: () => Promise<ThreatItem[]>;
  /** Save a named threat model snapshot to the backend */
  onSaveThreatModel?: (name: string, threats: ThreatItem[]) => Promise<void>;
  /** Project ID — needed to load threat history (cloud only) */
  projectId?: string;
  isLoading: boolean;
  status?: string;
  onClose: () => void;
  hasNodes: boolean;
  /** When true: read-only published diagram — evaluation & Q&A only, no generation */
  isReadOnly?: boolean;
  /** Pre-populate with saved chat history (cloud projects) */
  initialMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const WELCOME_GENERATE: Message = {
  role: 'assistant',
  content:
    "Hi! I'm your **AI diagram assistant**. Describe any system or architecture and I'll generate it on the canvas. You can also generate on a new layer.",
};

const WELCOME_READONLY: Message = {
  role: 'assistant',
  content:
    "You're viewing a **published diagram**. Ask me anything about this architecture, or click **Evaluate** for a full design analysis.",
};

const EXAMPLES_GENERATE = [
  'Microservices e-commerce platform',
  'Real-time chat app with WebSockets',
  'Data pipeline with Kafka and Spark',
  'Multi-region AWS deployment',
];

const EXAMPLES_QA = [
  'What are the scalability risks?',
  'How would you add caching here?',
  'What are the single points of failure?',
  'How does data flow end-to-end?',
];

// ── Markdown component map ────────────────────────────────────────────────────
const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 mt-3 text-base font-bold text-slate-900 dark:text-slate-100">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1.5 mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{children}</h3>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-slate-600 dark:text-slate-300">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-sm">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = /language-/.test(className ?? '');
    return isBlock ? (
      <code className={`font-mono text-xs text-blue-700 dark:text-blue-300 ${className ?? ''}`}>{children}</code>
    ) : (
      <code className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-slate-700 dark:text-blue-300">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl bg-slate-100 p-4 text-xs leading-relaxed ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-600">
      {children}
    </pre>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-blue-600 underline decoration-blue-400/40 underline-offset-2 hover:text-blue-500 dark:text-blue-400 dark:decoration-blue-500/40 dark:hover:text-blue-300"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-3 overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-slate-600">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-slate-100 px-3 py-2 text-slate-600 last:border-0 dark:border-slate-700 dark:text-slate-300">
      {children}
    </td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-2 border-l-2 border-blue-400/60 pl-3 italic text-slate-600 dark:text-slate-400">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200 dark:border-slate-600" />,
};

function ThinkingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      {label && <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>}
    </div>
  );
}

export default function AIChatPanel({
  onGenerate,
  onGenerateNewLayer,
  onEvaluate,
  onThreatAnalysis,
  onSaveThreatModel,
  projectId,
  isLoading,
  status,
  onClose,
  hasNodes,
  isReadOnly = false,
  initialMessages,
}: AIChatPanelProps) {
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  const welcome = isReadOnly ? WELCOME_READONLY : WELCOME_GENERATE;
  const [messages, setMessages] = useState<Message[]>(() =>
    initialMessages && initialMessages.length > 0 ? initialMessages : [welcome],
  );

  // When history loads asynchronously (cloud project), populate messages once
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);
  const [input, setInput] = useState('');
  const [layerPrompt, setLayerPrompt] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isAnalyzingThreats, setIsAnalyzingThreats] = useState(false);
  const [pendingThreats, setPendingThreats] = useState<ThreatItem[] | null>(null);
  const [saveModelName, setSaveModelName] = useState('');
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const streamingContentRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pushMsg = (msg: Message) => setMessages((prev) => [...prev, msg]);
  const replaceLastMsg = (msg: Message) =>
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = msg;
      return updated;
    });

  // ── Streaming helper (used for evaluate + Q&A) ───────────────────────────
  const runStreaming = async (userLabel: string, question?: string) => {
    if (!onEvaluate || isEvaluating || isLoading) return;
    setIsEvaluating(true);
    streamingContentRef.current = '';
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userLabel },
      { role: 'assistant', content: '', isLoading: true },
    ]);
    try {
      await onEvaluate((chunk: string) => {
        streamingContentRef.current += chunk;
        const accumulated = streamingContentRef.current;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }, question);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        };
        return updated;
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── Generation helpers (normal mode only) ───────────────────────────────
  const runGenerate = async (prompt: string, onNewLayer?: { layerName: string }) => {
    pushMsg({
      role: 'assistant',
      content: onNewLayer
        ? `Creating new layer "${onNewLayer.layerName}"…`
        : 'Generating your diagram…',
      isLoading: true,
    });
    try {
      if (onNewLayer) {
        await onGenerateNewLayer(prompt, onNewLayer.layerName);
        replaceLastMsg({
          role: 'assistant',
          content: `Done! Diagram generated on new layer **"${onNewLayer.layerName}"**.`,
        });
      } else {
        await onGenerate(prompt);
        replaceLastMsg({
          role: 'assistant',
          content: 'Diagram generated! Feel free to ask for another or evaluate the result.',
        });
      }
    } catch {
      replaceLastMsg({
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      });
    }
  };

  // ── Threat analysis ─────────────────────────────────────────────────────
  const runThreatAnalysis = async () => {
    if (!onThreatAnalysis || isAnalyzingThreats || isLoading || isEvaluating) return;
    setIsAnalyzingThreats(true);
    setPendingThreats(null);
    setSaveModelName('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: 'Run STRIDE threat analysis' },
      { role: 'assistant', content: '', isLoading: true },
    ]);
    try {
      const threats = await onThreatAnalysis();
      const summary = `Found **${threats.length}** threat${threats.length !== 1 ? 's' : ''}. Review in the **Threat Model panel** (⌘T) and save as a named model if you want to keep this analysis.`;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: summary, threatResults: threats };
        return updated;
      });
      setPendingThreats(threats);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Threat analysis failed. Please try again.',
        };
        return updated;
      });
    } finally {
      setIsAnalyzingThreats(false);
    }
  };

  const handleSaveThreatModel = async () => {
    if (!onSaveThreatModel || !pendingThreats || isSavingModel) return;
    setIsSavingModel(true);
    try {
      await onSaveThreatModel(saveModelName || 'Threat Analysis', pendingThreats);
      setPendingThreats(null);
      setSaveModelName('');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '✓ Threat model saved successfully.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Failed to save threat model. Please try again.' },
      ]);
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || isEvaluating) return;
    setInput('');

    // Read-only mode: treat input as a Q&A question about the diagram
    if (isReadOnly) {
      await runStreaming(trimmed, trimmed);
      return;
    }

    // Normal generation mode
    if (hasNodes) {
      setLayerPrompt(trimmed);
      pushMsg({ role: 'user', content: trimmed });
      pushMsg({
        role: 'assistant',
        content:
          'The canvas already has content. Would you like to generate on the **current layer** (replaces existing) or create a **new layer**?',
      });
      return;
    }

    pushMsg({ role: 'user', content: trimmed });
    await runGenerate(trimmed);
  };

  const handleCurrentLayer = async () => {
    if (!layerPrompt) return;
    const prompt = layerPrompt;
    setLayerPrompt(null);
    await runGenerate(prompt);
  };

  const handleNewLayer = async () => {
    if (!layerPrompt) return;
    const prompt = layerPrompt;
    setLayerPrompt(null);
    const layerName = `AI: ${prompt.slice(0, 28)}${prompt.length > 28 ? '…' : ''}`;
    await runGenerate(prompt, { layerName });
  };

  const examples = isReadOnly ? EXAMPLES_QA : EXAMPLES_GENERATE;
  const placeholder = isReadOnly
    ? 'Ask about this architecture… (Enter to send)'
    : 'Describe a diagram… (Enter to send)';
  const isBusy = isLoading || isEvaluating || isAnalyzingThreats;

  return (
    <aside className="relative flex h-full w-[360px] flex-shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-200 dark:bg-slate-700 dark:ring-slate-600">
          <Sparkles size={15} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Assistant</span>
            {isReadOnly && (
              <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Lock size={8} />
                View only
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            {isReadOnly ? 'Evaluation & Q&A mode' : 'Diagram Generation · Claude'}
          </div>
        </div>
        {/* History button — cloud projects with threat support only */}
        {projectId && onThreatAnalysis && (
          <button
            onClick={() => setShowHistory((v) => !v)}
            title="Saved threat models"
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 ${showHistory ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' : ''}`}
          >
            <History size={14} />
          </button>
        )}
        <button
          onClick={onClose}
          title="Close AI panel (⌘I)"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Threat History view (replaces chat when active) ───────────────── */}
      {showHistory && projectId && (
        <ThreatHistoryPanel
          projectId={projectId}
          isDark={isDark}
          onBack={() => setShowHistory(false)}
        />
      )}

      {/* ── Messages ──────────────────────────────────────────────────────── */}
      {!showHistory && <div className="relative flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              /* User bubble */
              <div key={i} className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                  {msg.content}
                </div>
              </div>
            ) : (
              /* Assistant message with avatar */
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-200 dark:bg-slate-700 dark:ring-slate-600">
                  <Sparkles size={11} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">
                  {msg.isLoading ? (
                    <ThinkingDots label={isAnalyzingThreats ? 'Analyzing threats…' : (status ?? 'Thinking…')} />
                  ) : (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {msg.content}
                      </ReactMarkdown>
                      {msg.threatResults && msg.threatResults.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.threatResults.map((t, ti) => (
                            <ThreatResultCard key={ti} threat={t} isDark={isDark} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ),
          )}

          {/* Layer choice — normal mode only */}
          {layerPrompt && !isLoading && (
            <div className="flex gap-2 pl-9">
              <button
                onClick={handleCurrentLayer}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500"
              >
                Current layer
              </button>
              <button
                onClick={handleNewLayer}
                className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                New layer
              </button>
            </div>
          )}

          {/* Example prompts — welcome screen only */}
          {messages.length === 1 && (
            <div className="pl-9">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {isReadOnly ? 'Questions to ask' : 'Try an example'}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {examples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setInput(ex);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 text-left text-xs leading-snug text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-600 dark:hover:text-slate-100"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>}

      {/* ── Input footer ──────────────────────────────────────────────────── */}
      {!showHistory && <div className="relative flex-shrink-0 space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
        {/* Evaluate + Threat Analysis quick-actions */}
        {hasNodes && !isBusy && (
          <div className="flex gap-2">
            {onEvaluate && (
              <button
                onClick={() => runStreaming('Evaluate this diagram')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 py-1.5 text-xs font-medium text-amber-600 transition hover:bg-amber-400/20 dark:text-amber-400"
              >
                <ScanSearch size={12} />
                Evaluate
              </button>
            )}
            {onThreatAnalysis && !isReadOnly && (
              <button
                onClick={runThreatAnalysis}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-400/20 dark:text-red-400"
              >
                <ShieldAlert size={12} />
                Threat Analysis
              </button>
            )}
          </div>
        )}

        {/* Save threat model — shown after analysis completes */}
        {pendingThreats && !isBusy && onSaveThreatModel && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-600 dark:bg-slate-900/50">
            <input
              value={saveModelName}
              onChange={(e) => setSaveModelName(e.target.value)}
              placeholder="Model name (optional)"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none placeholder-slate-400 focus:ring-1 focus:ring-blue-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
            <button
              onClick={handleSaveThreatModel}
              disabled={isSavingModel}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {isSavingModel ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Save
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            rows={2}
            disabled={isBusy || (!isReadOnly && !!layerPrompt)}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isBusy || (!isReadOnly && !!layerPrompt)}
            className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
          Enter to send · Shift+Enter for new line
        </p>
      </div>}
    </aside>
  );
}
