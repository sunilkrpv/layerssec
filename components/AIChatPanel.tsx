'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, X, ScanSearch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
}

interface AIChatPanelProps {
  onGenerate: (prompt: string) => Promise<void>;
  onGenerateNewLayer: (prompt: string, layerName: string) => Promise<void>;
  /** Called when user asks to evaluate the diagram; streams text chunks via onChunk callback */
  onEvaluate?: (onChunk: (chunk: string) => void) => Promise<void>;
  isLoading: boolean;
  status?: string;
  onClose: () => void;
  hasNodes: boolean;
}

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'm your **AI diagram assistant**. Describe any system or architecture and I'll generate it on the canvas. You can also generate on a new layer.",
};

const EXAMPLES = [
  'Microservices e-commerce platform',
  'Real-time chat app with WebSockets',
  'Data pipeline with Kafka and Spark',
  'Multi-region AWS deployment',
];

// Markdown component map — keeps the message list render clean
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
    <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{children}</h3>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
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
      <code className={`font-mono text-xs text-slate-100 ${className ?? ''}`}>{children}</code>
    ) : (
      <code className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700 dark:bg-slate-700/80 dark:text-indigo-300">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed dark:bg-slate-950">
      {children}
    </pre>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-slate-100 px-3 py-2 text-slate-600 last:border-0 dark:border-slate-800 dark:text-slate-400">
      {children}
    </td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-2 border-l-2 border-indigo-400 pl-3 italic text-slate-500 dark:text-slate-400">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200 dark:border-slate-700" />,
};

function ThinkingDots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex gap-1">
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </div>
  );
}

export default function AIChatPanel({
  onGenerate,
  onGenerateNewLayer,
  onEvaluate,
  isLoading,
  status,
  onClose,
  hasNodes,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [layerPrompt, setLayerPrompt] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
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
          content: 'Diagram generated! You can see it on the canvas. Feel free to ask for another.',
        });
      }
    } catch {
      replaceLastMsg({
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      });
    }
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');

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

  const handleEvaluate = async () => {
    if (!onEvaluate || isEvaluating || isLoading) return;
    setIsEvaluating(true);
    streamingContentRef.current = '';
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: 'Evaluate this diagram' },
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
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, evaluation failed. Please try again.',
        };
        return updated;
      });
    } finally {
      setIsEvaluating(false);
    }
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

  return (
    <aside className="flex h-full w-[360px] flex-shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-700/80 dark:bg-slate-900">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <Sparkles size={14} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight text-white">AI Assistant</div>
          <div className="text-[10px] leading-tight text-white/60">Diagram Generation · Claude</div>
        </div>
        <button
          onClick={onClose}
          title="Close AI panel"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              /* User bubble — right aligned */
              <div key={i} className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                  {msg.content}
                </div>
              </div>
            ) : (
              /* Assistant — left aligned with avatar */
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                  <Sparkles size={11} className="text-white" />
                </div>
                <div className="min-w-0 flex-1 text-slate-700 dark:text-slate-300">
                  {msg.isLoading ? (
                    <ThinkingDots label={status ?? 'Thinking…'} />
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ),
          )}

          {/* Layer choice buttons */}
          {layerPrompt && !isLoading && (
            <div className="flex gap-2 pl-9">
              <button
                onClick={handleCurrentLayer}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
              >
                Current layer
              </button>
              <button
                onClick={handleNewLayer}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                New layer
              </button>
            </div>
          )}

          {/* Example prompts — shown only on the welcome screen */}
          {messages.length === 1 && (
            <div className="pl-9">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Try an example
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setInput(ex);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-left text-xs leading-snug text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-300"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 space-y-2 border-t border-slate-100 p-3 dark:border-slate-800">
        {/* Evaluate quick-action */}
        {hasNodes && onEvaluate && !isEvaluating && !isLoading && (
          <button
            onClick={handleEvaluate}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/80 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800/50 dark:bg-amber-900/10 dark:text-amber-400 dark:hover:bg-amber-900/20"
          >
            <ScanSearch size={12} />
            Evaluate this diagram
          </button>
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
            placeholder="Describe a diagram… (Enter to send)"
            rows={2}
            disabled={isLoading || !!layerPrompt}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-indigo-600 dark:focus:bg-slate-800 dark:focus:ring-indigo-900/30"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || !!layerPrompt}
            className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-600">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </aside>
  );
}
