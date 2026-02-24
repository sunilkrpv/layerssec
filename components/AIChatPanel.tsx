'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, X, Minus, ChevronUp, ScanSearch } from 'lucide-react';

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
  isMinimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
  hasNodes: boolean;
}

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'm your diagram assistant. Describe any system or architecture and I'll generate it on the canvas. You can also ask me to create it on a new layer.",
};

const EXAMPLES = [
  'Create a microservices e-commerce architecture',
  'Design a real-time chat app with WebSockets',
  'Show a data pipeline with Kafka and Spark',
  'Draw a multi-region AWS deployment with failover',
];

export default function AIChatPanel({
  onGenerate,
  onGenerateNewLayer,
  onEvaluate,
  isLoading,
  status,
  isMinimized,
  onMinimize,
  onExpand,
  onClose,
  hasNodes,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  // pending prompt awaiting layer decision
  const [layerPrompt, setLayerPrompt] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const streamingContentRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        ? `Creating new layer "${onNewLayer.layerName}"...`
        : 'Generating your diagram...',
      isLoading: true,
    });
    try {
      if (onNewLayer) {
        await onGenerateNewLayer(prompt, onNewLayer.layerName);
        replaceLastMsg({
          role: 'assistant',
          content: `Done! Diagram generated on new layer "${onNewLayer.layerName}".`,
        });
      } else {
        await onGenerate(prompt);
        replaceLastMsg({
          role: 'assistant',
          content:
            'Diagram generated! You can see it on the canvas. Feel free to ask for another diagram.',
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

    // If canvas has existing nodes, ask user which layer to use
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

  // ── Minimized state ────────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-6 z-40">
        <button
          onClick={onExpand}
          className="flex items-center gap-2 rounded-t-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
        >
          <Sparkles size={14} />
          <span>AI Assistant</span>
          <ChevronUp size={14} />
        </button>
      </div>
    );
  }

  // ── Full panel ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed bottom-0 right-6 z-40 flex w-96 flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl"
      style={{ maxHeight: '580px' }}
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-2 bg-blue-600 px-4 py-3">
        <Sparkles size={15} className="text-white" />
        <span className="flex-1 text-sm font-semibold text-white">AI Diagram Assistant</span>
        <button
          onClick={onMinimize}
          className="rounded p-1 text-white/70 hover:bg-white/20 hover:text-white"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={onClose}
          className="rounded p-1 text-white/70 hover:bg-white/20 hover:text-white"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'whitespace-pre-wrap bg-slate-100 text-slate-800'
                }`}
              >
                {msg.isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    {status || 'Generating...'}
                  </span>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {/* Layer choice buttons */}
          {layerPrompt && !isLoading && (
            <div className="flex gap-2">
              <button
                onClick={handleCurrentLayer}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Current layer
              </button>
              <button
                onClick={handleNewLayer}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                New layer
              </button>
            </div>
          )}

          {/* Example prompts shown only with welcome message */}
          {messages.length === 1 && (
            <div className="mt-1 space-y-1.5">
              <p className="text-xs font-medium text-slate-400">Try an example:</p>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 hover:bg-white hover:border-blue-200"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Evaluate quick-action */}
      {hasNodes && onEvaluate && !isEvaluating && !isLoading && (
        <div className="flex-shrink-0 border-t border-slate-100 px-3 pt-2">
          <button
            onClick={handleEvaluate}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            <ScanSearch size={12} />
            Evaluate this diagram
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
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
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || !!layerPrompt}
            className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
