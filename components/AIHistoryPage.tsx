'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MessageSquare, PlusCircle, Send, Sparkles, SquarePen, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiChatAsk, apiGetChatHistory, ApiUnauthorizedError, type ChatMessage } from '@/lib/api';

interface AIHistoryPageProps {
  projectId: string;
}

// ── Discriminated union for rendered items ──────────────────────────────────

type UIItem =
  | { kind: 'message'; data: ChatMessage }
  | { kind: 'streaming'; content: string }
  | { kind: 'separator' };

// ── Markdown components ─────────────────────────────────────────────────────

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 mt-3 text-base font-bold text-white">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-1.5 mt-3 text-sm font-bold text-white">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-indigo-100">{children}</h3>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-indigo-200">{children}</em>
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
      <code className={`font-mono text-xs text-blue-200 ${className ?? ''}`}>{children}</code>
    ) : (
      <code className="rounded bg-indigo-800/60 px-1.5 py-0.5 font-mono text-xs text-blue-200">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-3 overflow-x-auto rounded-xl bg-black/40 p-4 text-xs leading-relaxed ring-1 ring-white/10">
      {children}
    </pre>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      className="text-blue-300 underline decoration-blue-500/40 underline-offset-2 hover:text-blue-200"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

// ── ThinkingDots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-indigo-400"
          style={{ animation: 'thinking-dot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}
        />
      ))}
      <style>{`@keyframes thinking-dot { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </span>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function AIHistoryPage({ projectId }: AIHistoryPageProps) {
  const router = useRouter();
  const [uiItems, setUiItems] = useState<UIItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history on mount
  useEffect(() => {
    apiGetChatHistory(projectId)
      .then((msgs) => {
        setUiItems(msgs.map((m) => ({ kind: 'message', data: m })));
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiUnauthorizedError) {
          router.push('/projects');
          return;
        }
        setError('Failed to load chat history.');
        setIsLoading(false);
      });
  }, [projectId, router]);

  // Scroll to bottom on new items
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uiItems]);

  const messageCount = uiItems.filter((i) => i.kind === 'message').length;

  // Build history for AI context — messages after the last separator
  function buildHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    let start = 0;
    for (let i = uiItems.length - 1; i >= 0; i--) {
      if (uiItems[i].kind === 'separator') { start = i + 1; break; }
    }
    return uiItems
      .slice(start)
      .filter((item): item is { kind: 'message'; data: ChatMessage } => item.kind === 'message')
      .slice(-20)
      .map((item) => ({ role: item.data.role, content: item.data.content }));
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');

    const history = buildHistory();

    // Optimistic user message
    const fakeUserMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      projectId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setUiItems((prev) => [
      ...prev,
      { kind: 'message', data: fakeUserMsg },
      { kind: 'streaming', content: '' },
    ]);
    setIsStreaming(true);
    streamingRef.current = '';

    try {
      await apiChatAsk(
        { message: text, projectId, history },
        (chunk) => {
          streamingRef.current += chunk;
          const accumulated = streamingRef.current;
          setUiItems((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (next[lastIdx]?.kind === 'streaming') {
              next[lastIdx] = { kind: 'streaming', content: accumulated };
            }
            return next;
          });
        },
      );

      // Replace streaming item with a persisted message item
      const assistantMsg: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        projectId,
        role: 'assistant',
        content: streamingRef.current,
        createdAt: new Date().toISOString(),
      };
      setUiItems((prev) => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (next[lastIdx]?.kind === 'streaming') {
          next[lastIdx] = { kind: 'message', data: assistantMsg };
        }
        return next;
      });
    } catch {
      setUiItems((prev) => prev.filter((i) => i.kind !== 'streaming'));
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleNewConversation() {
    setUiItems((prev) => [...prev, { kind: 'separator' }]);
    textareaRef.current?.focus();
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #1e3a8a 50%, #0f172a 100%)' }}
    >
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute top-1/3 -left-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 h-56 w-56 rounded-full bg-violet-600/8 blur-3xl" />
      </div>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-indigo-200/70 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={15} />
          Back to diagram
        </button>

        <div className="h-4 w-px bg-white/15" />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Sparkles size={13} className="text-blue-300" />
          </div>
          <span className="text-sm font-semibold text-white">AI History</span>
        </div>

        <span className="ml-auto text-xs text-indigo-300/50">
          {messageCount} message{messageCount !== 1 ? 's' : ''}
        </span>

        <button
          onClick={handleNewConversation}
          title="New conversation"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-indigo-200/70 transition hover:bg-white/10 hover:text-white"
        >
          <SquarePen size={13} />
          New
        </button>
      </div>

      {/* ── Message list ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-sm text-indigo-300/60">
            Loading history…
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20 text-sm text-red-400">
            {error}
          </div>
        )}

        {!isLoading && !error && uiItems.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <MessageSquare size={24} className="text-indigo-300/60" />
            </div>
            <p className="text-sm font-medium text-indigo-200/70">No AI conversations yet</p>
            <p className="max-w-xs text-xs text-indigo-300/40">
              Send a message below to start a conversation.
            </p>
          </div>
        )}

        {!isLoading && !error && uiItems.length > 0 && (
          <div className="mx-auto max-w-2xl space-y-4">
            {uiItems.map((item, i) => {
              // Session separator
              if (item.kind === 'separator') {
                return (
                  <div key={`sep-${i}`} className="flex items-center gap-3 py-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-indigo-300/40">
                      <PlusCircle size={10} />
                      New conversation
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                );
              }

              // Streaming assistant bubble
              if (item.kind === 'streaming') {
                return (
                  <div key={`streaming-${i}`} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/30 ring-1 ring-indigo-400/40">
                      <Sparkles size={12} className="text-blue-300" />
                    </div>
                    <div className="max-w-[85%] min-w-0">
                      <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-indigo-100/90 ring-1 ring-white/10" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        {item.content === '' ? (
                          <ThinkingDots />
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                            {item.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Regular message
              const msg = item.data;
              // Find previous message (skip separators) for date comparison
              const prevMsg = (() => {
                for (let j = i - 1; j >= 0; j--) {
                  if (uiItems[j].kind === 'message') return (uiItems[j] as { kind: 'message'; data: ChatMessage }).data;
                }
                return null;
              })();
              const showDateSep = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-px flex-1 bg-white/10" />
                      <span className="text-[10px] font-medium uppercase tracking-widest text-indigo-300/40">
                        {formatDate(msg.createdAt)}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                  )}

                  {msg.role === 'user' ? (
                    <div className="flex items-start justify-end gap-3">
                      <div className="max-w-[80%]">
                        {msg.layerName && (
                          <div className="mb-1 flex justify-end">
                            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300/60">
                              {msg.layerName}
                            </span>
                          </div>
                        )}
                        <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-sm text-white">
                          {msg.content}
                        </div>
                        <div className="mt-1 text-right text-[10px] text-indigo-300/40">
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/30 ring-1 ring-indigo-400/30">
                        <User size={13} className="text-indigo-200" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/30 ring-1 ring-indigo-400/40">
                        <Sparkles size={12} className="text-blue-300" />
                      </div>
                      <div className="max-w-[85%] min-w-0">
                        {msg.layerName && (
                          <div className="mb-1">
                            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-300/60">
                              {msg.layerName}
                            </span>
                          </div>
                        )}
                        <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-indigo-100/90 ring-1 ring-white/10" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        <div className="mt-1 text-[10px] text-indigo-300/40">
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input footer ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-shrink-0 border-t border-white/10 p-4">
        <div className="mx-auto flex max-w-2xl items-end gap-3">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || isLoading}
            placeholder="Send a message… (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white placeholder-indigo-300/40 ring-1 ring-white/15 outline-none transition focus:ring-indigo-400/50 disabled:opacity-50"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming || isLoading}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
