'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send, ArrowRight, Shield, Zap, BarChart3, X, Loader2,
  Sparkles, ExternalLink,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { apiCreateProject, apiCreateDiagram, apiChatGenerate } from '@/lib/api';
import { generateId } from '@/lib/diagramUtils';
import { cn } from '@/lib/utils';
import MiniDiagramPreview from './MiniDiagramPreview';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'greeting' | 'building' | 'complete';

interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
}

export interface NewProjectChatProps {
  /** When provided the component renders embedded (no full-screen); X button calls this. */
  onDismiss?: () => void;
  /** Called after project + diagram creation so the parent can refresh / select the project. */
  onCreated?: (projectId: string) => void;
}

// ── ThinkingDots ──────────────────────────────────────────────────────────────

function ThinkingDots({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {label && (
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      )}
      <span className="inline-flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-blue-400 dark:bg-blue-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </span>
  );
}

// ── ChatBubble ────────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: Message }) {
  const isAI = message.role === 'ai';
  return (
    <div className={cn('flex', isAI ? 'justify-start' : 'justify-end')}>
      {isAI && (
        <div className="mr-2.5 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
          <LayersLogo size={13} className="text-white" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed',
          isAI
            ? 'rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
            : 'rounded-tr-sm bg-blue-600 text-white',
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

// ── NavPrompt ─────────────────────────────────────────────────────────────────

function NavPrompt({
  projectId,
  onStay,
  onOpen,
}: {
  projectId: string;
  onStay: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="ml-9 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[14px] font-medium text-slate-800 dark:text-slate-100">
        What would you like to do next?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onOpen}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <ExternalLink size={14} />
          Open Diagram
        </button>
        <button
          onClick={onStay}
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          Continue building here
        </button>
      </div>
    </div>
  );
}

// ── ActionButtons ─────────────────────────────────────────────────────────────

const ACTIONS = [
  { id: 'trust', icon: Shield, label: 'Add Trust Boundaries', color: 'text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/40' },
  { id: 'stride', icon: Zap, label: 'Run STRIDE Analysis', color: 'text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/40' },
  { id: 'posture', icon: BarChart3, label: 'Compute Posture Score', color: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/40' },
  { id: 'open', icon: ArrowRight, label: 'Open Diagram', color: 'text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800' },
];

function ActionButtons({ onAction }: { onAction: (id: string) => void }) {
  return (
    <div className="ml-9 flex flex-wrap gap-2">
      {ACTIONS.map(({ id, icon: Icon, label, color }) => (
        <button
          key={id}
          onClick={() => onAction(id)}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-colors',
            color,
          )}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── EmptyHero ─────────────────────────────────────────────────────────────────

function EmptyHero() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
        <Sparkles size={22} className="text-blue-600 dark:text-blue-400" />
      </div>
      <h2 className="text-[18px] font-semibold text-slate-800 dark:text-slate-100">
        Start a new project
      </h2>
      <p className="mt-1 max-w-[380px] text-[14px] text-slate-500 dark:text-slate-400">
        Describe what you&apos;re building and I&apos;ll generate an architecture diagram, then help you run threat analysis.
      </p>
    </div>
  );
}

// ── NewProjectChat ────────────────────────────────────────────────────────────

export default function NewProjectChat({ onDismiss, onCreated }: NewProjectChatProps = {}) {
  const router = useRouter();
  const embedded = !!onDismiss;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('greeting');
  const [thinking, setThinking] = useState(true);
  const [thinkingLabel, setThinkingLabel] = useState('');
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [diagramNodes, setDiagramNodes] = useState<unknown[]>([]);
  const [diagramEdges, setDiagramEdges] = useState<unknown[]>([]);
  const [showNavPrompt, setShowNavPrompt] = useState(false);
  const [navPromptDismissed, setNavPromptDismissed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Show AI greeting on mount with a brief thinking animation
  useEffect(() => {
    const t = setTimeout(() => {
      setThinking(false);
      addMessage('ai', "Hi! I'm going to help you set up your new project. What are you building, and what should we call it?");
      inputRef.current?.focus();
    }, 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking, showNavPrompt]);

  const addMessage = (role: 'ai' | 'user', text: string) => {
    setMessages((prev) => [...prev, { id: generateId(), role, text }]);
  };

  const extractProjectName = (text: string): string => {
    const patterns = [
      /(?:call(?:ed)?|name(?:d)?|it[''']s|called)\s+["']?([A-Za-z0-9 _\-]+)["']?/i,
      /["']([^"']{2,40})["']/,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m) return m[1].trim();
    }
    const first = text.split(/[.\n]/)[0].trim();
    if (first.length <= 40 && first.split(' ').length <= 5) return first;
    return `Project ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || thinking || phase === 'complete') return;

    setInput('');
    addMessage('user', text);
    setThinking(true);
    setThinkingLabel('');

    try {
      if (phase === 'greeting') {
        const projectName = extractProjectName(text);

        setThinkingLabel(`Creating "${projectName}"…`);
        const project = await apiCreateProject(projectName, text);
        setCreatedProjectId(project.id);
        setPhase('building');

        setThinkingLabel('Generating your architecture…');
        try {
          const result = await apiChatGenerate({ prompt: text, projectId: project.id });

          setThinkingLabel('Saving diagram…');
          const rootLayerId = 'root';
          const canvasData = {
            layers: {
              [rootLayerId]: {
                id: rootLayerId,
                name: 'Root Layer',
                description: projectName,
                parentLayerId: null,
                parentNodeId: null,
                nodes: result.nodes,
                edges: result.edges,
                createdAt: new Date().toISOString(),
              },
            },
            navStack: [rootLayerId],
          };

          await apiCreateDiagram(project.id, projectName, canvasData);

          setDiagramNodes(result.nodes as unknown[]);
          setDiagramEdges(result.edges as unknown[]);
          setThinking(false);
          setThinkingLabel('');

          addMessage(
            'ai',
            `Your architecture is ready — ${(result.nodes as unknown[]).length} components generated. Here's a preview:`,
          );
          setPhase('complete');
          if (embedded) {
            setShowNavPrompt(true);
            onCreated?.(project.id);
          }
        } catch {
          setThinking(false);
          setThinkingLabel('');
          addMessage('ai', "I had trouble generating the diagram, but your project is created. You can open it and build manually.");
          setPhase('complete');
          if (embedded) {
            setShowNavPrompt(true);
            onCreated?.(project.id);
          }
        }
      }
    } catch {
      addMessage('ai', 'Something went wrong creating your project. Please try again.');
      setThinking(false);
      setThinkingLabel('');
    }
  }, [input, thinking, phase, embedded, onCreated]);

  const handleAction = (action: string) => {
    if (!createdProjectId) return;
    const base = `/projects/${createdProjectId}`;
    switch (action) {
      case 'open': router.push(base); break;
      case 'trust': router.push(`${base}?action=trust-boundary`); break;
      case 'stride': router.push(`${base}?action=stride`); break;
      case 'posture': router.push(`${base}?action=posture`); break;
      default: router.push(base);
    }
  };

  const handleOpenDiagram = () => {
    if (createdProjectId) router.push(`/projects/${createdProjectId}`);
  };

  const handleSkip = async () => {
    const name = `Project ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    try {
      const project = await apiCreateProject(name);
      if (embedded) {
        onCreated?.(project.id);
        onDismiss?.();
      } else {
        router.push(`/projects/${project.id}`);
      }
    } catch {
      if (embedded) onDismiss?.();
      else router.push('/home');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Shared chat thread content ───────────────────────────────────────────
  const chatThread = (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
        {/* Empty hero shown before any message is sent (and greeting hasn't appeared yet) */}
        {messages.length === 0 && !thinking && <EmptyHero />}

        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="mr-2.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
              <LayersLogo size={13} className="text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800">
              <ThinkingDots label={thinkingLabel} />
            </div>
          </div>
        )}

        {/* Mini diagram preview */}
        {phase === 'complete' && diagramNodes.length > 0 && (
          <div className="flex justify-start pl-9">
            <div className="w-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                  {diagramNodes.length} components · {diagramEdges.length} connections
                </span>
              </div>
              <div className="h-[240px]">
                <MiniDiagramPreview nodes={diagramNodes} edges={diagramEdges} className="h-full rounded-none border-0" />
              </div>
            </div>
          </div>
        )}

        {/* Post-creation: nav prompt (embedded) or action buttons (standalone) */}
        {phase === 'complete' && embedded && showNavPrompt && !navPromptDismissed && createdProjectId && (
          <NavPrompt
            projectId={createdProjectId}
            onOpen={handleOpenDiagram}
            onStay={() => setNavPromptDismissed(true)}
          />
        )}
        {phase === 'complete' && (!embedded || navPromptDismissed) && (
          <ActionButtons onAction={handleAction} />
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );

  // ── Input bar ────────────────────────────────────────────────────────────
  const inputBar = (
    <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex w-full max-w-[680px] items-end gap-3 align-bottom">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={thinking || phase === 'complete'}
          placeholder="e.g. A REST API with Postgres, Redis cache, and a React frontend — call it API Gateway"
          rows={4}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-relaxed text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-800"
          style={{ minHeight: '96px', maxHeight: '200px' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking || phase === 'complete'}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {thinking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-[680px] text-center text-[11px] text-slate-400 dark:text-slate-600">
        Shift+Enter for new line · Enter to send
      </p>
    </div>
  );

  // ── Embedded layout ───────────────────────────────────────────────────────
  if (embedded) {
    return (
      <div className="flex h-full flex-col bg-white dark:bg-slate-950">
        {/* Embedded header */}
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">New Project</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSkip}
              className="text-[13px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              Skip setup
            </button>
            <button
              onClick={onDismiss}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {chatThread}
        {inputBar}
      </div>
    );
  }

  // ── Standalone / full-screen layout ───────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-950">
      <header className="flex h-12 flex-shrink-0 items-center border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <LayersLogo size={16} className="text-blue-500" />
          <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">New Project</span>
        </div>
        <button
          onClick={handleSkip}
          className="ml-auto text-[13px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Skip setup →
        </button>
      </header>
      {chatThread}
      {inputBar}
    </div>
  );
}
