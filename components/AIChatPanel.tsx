'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Sparkles, Send, Loader2, X, ScanSearch, Lock, ShieldAlert, Save, History,
  Layers, Shield, CheckCircle2, AlertTriangle, AlertCircle, ArrowRight,
  BarChart2, Cpu, ChevronDown, Info,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/lib/themeContext';
import { splitPrimer, primerLabel, type PrimerMessage } from '@/lib/panelPrimer';
import ThreatResultCard from '@/components/ThreatResultCard';
import ThreatHistoryPanel from '@/components/ThreatHistoryPanel';
import { PipelineNudge } from './PipelineNudge';
import type { ThreatItem, ThreatChatPayload, ThreatChatEvent, KeyFinding, PostureScoreJobResult, PostureScoreStreamEvent, AttackMindJobResult, AttackMindStreamEvent } from '@/lib/api';

const MiniDiagramPreview = dynamic(() => import('./MiniDiagramPreview'), { ssr: false });

interface PendingDiagram {
  nodes: unknown[];
  edges: unknown[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isLoading?: boolean;
  threatResults?: ThreatItem[];
}

// ── Threat agent message types ────────────────────────────────────────────────

type ThreatMessageType = 'text' | 'divider' | 'progress' | 'result';

interface ThreatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  msgType?: ThreatMessageType;
  // for progress/result cards
  jobId?: string;
  analysisResult?: {
    modelId: string;
    threatCount: number;
    summary: string;
    keyFindings: KeyFinding[];
  };
}

// idle → user clicks "Analyze Threats"
// diagnosing → first turn sent to backend, waiting for first delta
// conversing → first delta arrived, user can type replies
// analyzing → analysis_triggered event received
// complete → analysis_complete event received
type ThreatState = 'idle' | 'diagnosing' | 'conversing' | 'analyzing' | 'complete';
type PostureState = 'idle' | 'submitting' | 'running' | 'complete' | 'error';
type AttackState = 'idle' | 'submitting' | 'running' | 'complete' | 'error';

// Active tab
type PanelTab = 'ai' | 'threat' | 'posture' | 'attack';

interface AIChatPanelProps {
  onGenerate: (prompt: string) => Promise<void>;
  onGenerateNewLayer: (prompt: string, layerName: string) => Promise<void>;
  onGeneratePreview?: (prompt: string) => Promise<{ nodes: unknown[]; edges: unknown[] }>;
  onApplyGeneratedDiagram?: (nodes: unknown[], edges: unknown[], layerName?: string) => Promise<void>;
  onEvaluate?: (onChunk: (chunk: string) => void, question?: string) => Promise<void>;
  /** Legacy one-shot threat analysis (kept for back-compat) */
  onThreatAnalysis?: () => Promise<ThreatItem[]>;
  onSaveThreatModel?: (name: string, threats: ThreatItem[]) => Promise<void>;
  /** Multi-turn threat agent chat via SSE */
  onThreatAgentChat?: (payload: ThreatChatPayload) => AsyncGenerator<ThreatChatEvent>;
  /** Diagram data passed with each threat agent request */
  diagramId?: string;
  layerId?: string;
  layerName?: string;
  diagramNodes?: Array<{ id: string; type?: string; label?: string; technology?: string; description?: string; trustLevel?: string }>;
  diagramEdges?: Array<{ id: string; source: string; target: string; label?: string }>;
  diagramTrustBoundaries?: Array<{ id: string; label?: string; trustLevel?: string }>;
  /** Pre-populated threat agent history for resumability */
  initialThreatMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Posture Score stream function */
  onRunPostureScore?: (payload: {
    projectId: string;
    diagramId: string;
    diagramVersion: number;
    layers: unknown;
    useExtendedThinking?: boolean;
  }) => AsyncGenerator<PostureScoreStreamEvent>;
  /** Attack Mind stream function */
  onRunAttackMind?: (payload: {
    projectId: string;
    diagramId: string;
    diagramVersion: number;
    layers: unknown;
    entryPointNodeId?: string;
    useExtendedThinking?: boolean;
  }) => AsyncGenerator<AttackMindStreamEvent>;
  /** Current diagram version number */
  diagramVersion?: number;
  /** Full layers data for posture/attack analysis */
  diagramLayers?: unknown;
  projectId?: string;
  /** Navigate to Security Intel page */
  onShowSecurityIntel?: () => void;
  /** Called after diagram generation or manual save — advances pipeline to nudge */
  onDiagramReady?: () => void;
  /** Callback when pipeline phase changes (for Toolbar indicator) */
  onPipelinePhaseChange?: (phase: import('@/lib/pipelineState').PipelinePhase) => void;
  isLoading: boolean;
  status?: string;
  onClose: () => void;
  hasNodes: boolean;
  isReadOnly?: boolean;
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

// ── Severity icon helper ──────────────────────────────────────────────────────
function SeverityIcon({ severity }: { severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' }) {
  if (severity === 'CRITICAL')
    return <AlertCircle size={11} className="flex-shrink-0 text-red-500" />;
  if (severity === 'HIGH')
    return <AlertTriangle size={11} className="flex-shrink-0 text-orange-500" />;
  return <AlertTriangle size={11} className="flex-shrink-0 text-yellow-500" />;
}

// ── Inline threat progress / result card ─────────────────────────────────────
function ThreatProgressCard({ result }: { result?: ThreatMessage['analysisResult'] }) {
  if (!result) {
    // Progress state
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="mb-2 flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-blue-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Analyzing threats…</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
        </div>
      </div>
    );
  }

  // Complete state — result card
  const topFindings = result.keyFindings.slice(0, 4);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <Shield size={13} className="text-red-500" />
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          {result.threatCount} threat{result.threatCount !== 1 ? 's' : ''} identified
        </span>
        <CheckCircle2 size={11} className="ml-auto text-emerald-500" />
      </div>
      {topFindings.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {topFindings.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5">
              <SeverityIcon severity={f.severity} />
              <span className="flex-1 text-xs text-slate-700 dark:text-slate-300">{f.category}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{f.count}</span>
            </div>
          ))}
        </div>
      )}
      <div className="px-3 py-2">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            // DiagramPage wires this via window event or router
            window.dispatchEvent(new CustomEvent('layers:open-threat-model', { detail: { modelId: result.modelId } }));
          }}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          View full model <ArrowRight size={10} />
        </a>
      </div>
    </div>
  );
}

// ── Posture progress / result card ─────────────────────────────────────────
function PostureProgressCard({ result }: { result?: PostureScoreJobResult }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="mb-2 flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-purple-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Scoring your architecture…</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-purple-500" />
        </div>
      </div>
    );
  }

  const hasThreatPenalty = (result.threatPenalty ?? 0) > 0;
  // Strip the bracket prefix we embed in summary when a penalty is applied
  const cleanSummary = result.summary.replace(/^\[Architecture score:.*?\]\s*/, '');
  const scoreColor = result.score >= 70 ? 'text-emerald-600' : result.score >= 40 ? 'text-amber-600' : 'text-red-500';
  const scoreBg = result.score >= 70 ? 'bg-emerald-50 ring-emerald-200' : result.score >= 40 ? 'bg-amber-50 ring-amber-200' : 'bg-red-50 ring-red-200';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${scoreBg} dark:bg-slate-700 dark:ring-slate-600`}>
          <span className={`text-base font-bold ${scoreColor}`}>{result.score}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Security Posture Score</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">{result.layerCount} layer{result.layerCount !== 1 ? 's' : ''} analyzed</div>
        </div>
        <CheckCircle2 size={11} className="flex-shrink-0 text-emerald-500" />
      </div>

      {/* Scoring methodology info — always visible so users understand how the score is composed */}
      <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800/30">
        {hasThreatPenalty ? (
          <div className="flex items-start gap-1.5">
            <Info size={10} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Architecture score {result.rawLlmScore}/100
              </span>
              {' '}— minus{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {result.threatPenalty} pts threat penalty
              </span>
              {' '}for unmitigated STRIDE threats
              {' '}(CRITICAL ×4 · HIGH ×2 · MEDIUM ×0.5).
              {' '}Mitigate threats to raise this score.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-1.5">
            <Info size={10} className="mt-0.5 shrink-0 text-slate-400" />
            <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
              Score based on architectural patterns across 5 CISSP dimensions.
              {' '}Run threat analysis first to include a threat-adjusted penalty in this score.
            </p>
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        <p className="mb-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2">{cleanSummary}</p>
        {result.topRecs.length > 0 && (
          <ul className="mb-2 space-y-1">
            {result.topRecs.slice(0, 3).map((rec, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <ArrowRight size={9} className="mt-0.5 flex-shrink-0 text-purple-500" />
                <span className="line-clamp-1">{rec}</span>
              </li>
            ))}
          </ul>
        )}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('layers:open-posture-history')); }}
          className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-500 dark:text-purple-400"
        >
          View history <ArrowRight size={10} />
        </a>
      </div>
    </div>
  );
}

// ── Attack Mind progress / result card ─────────────────────────────────────
function AttackMindProgressCard({ result }: { result?: AttackMindJobResult }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
        <div className="mb-2 flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-orange-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Simulating attacker paths…</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-orange-500" />
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <Cpu size={13} className="text-orange-500" />
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Attack path simulated</span>
        <CheckCircle2 size={11} className="ml-auto text-emerald-500" />
      </div>
      <div className="px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Entry point</span>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{result.entryPointLabel}</span>
        </div>
        <p className="mb-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">{result.summary}</p>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('layers:open-attack-sim', { detail: { simulationId: result.simulationId } })); }}
          className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-500 dark:text-orange-400"
        >
          View full simulation <ArrowRight size={10} />
        </a>
      </div>
    </div>
  );
}

export default function AIChatPanel({
  onGenerate,
  onGenerateNewLayer,
  onGeneratePreview,
  onApplyGeneratedDiagram,
  onEvaluate,
  onThreatAnalysis,
  onSaveThreatModel,
  onThreatAgentChat,
  diagramId,
  layerId,
  layerName,
  diagramNodes,
  diagramEdges,
  diagramTrustBoundaries,
  initialThreatMessages,
  onRunPostureScore,
  onRunAttackMind,
  diagramVersion,
  diagramLayers,
  projectId,
  onShowSecurityIntel,
  onDiagramReady,
  onPipelinePhaseChange,
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

  // ── Tab state ───────────────────────────────────────────────────────────────
  const hasThreatAgent = !!onThreatAgentChat && !isReadOnly;
  const [activeTab, setActiveTab] = useState<PanelTab>('ai');

  // ── AI Assistant state ───────────────────────────────────────────────────
  const welcome = isReadOnly ? WELCOME_READONLY : WELCOME_GENERATE;
  const { primer: primerFromInitial, rest: initialRest } = initialMessages
    ? splitPrimer(initialMessages)
    : { primer: null, rest: [] as Array<{ role: 'user' | 'assistant'; content: string }> };
  const [primer, setPrimer] = useState<PrimerMessage | null>(primerFromInitial);
  const [messages, setMessages] = useState<Message[]>(() =>
    initialRest.length > 0 ? initialRest : [welcome],
  );
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      const { primer: p, rest } = splitPrimer(initialMessages);
      setPrimer(p);
      setMessages(rest.length > 0 ? rest : [welcome]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages]);

  const [input, setInput] = useState('');
  const [pendingDiagram, setPendingDiagram] = useState<PendingDiagram | null>(null);
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

  // ── Threat agent state ───────────────────────────────────────────────────
  const [threatMessages, setThreatMessages] = useState<ThreatMessage[]>(() =>
    initialThreatMessages && initialThreatMessages.length > 0
      ? initialThreatMessages.map((m) => ({ role: m.role, content: m.content, msgType: 'text' as ThreatMessageType }))
      : [],
  );
  useEffect(() => {
    if (initialThreatMessages && initialThreatMessages.length > 0) {
      setThreatMessages(
        initialThreatMessages.map((m) => ({ role: m.role, content: m.content, msgType: 'text' as ThreatMessageType })),
      );
    }
  }, [initialThreatMessages]);

  const [threatState, setThreatState] = useState<ThreatState>('idle');
  const [threatInput, setThreatInput] = useState('');
  const threatMessagesEndRef = useRef<HTMLDivElement>(null);
  const threatTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    threatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threatMessages]);

  // ── Posture Score state ───────────────────────────────────────────────────
  const hasPostureScore = !!onRunPostureScore && !isReadOnly;
  const [postureState, setPostureState] = useState<PostureState>('idle');
  const [postureResult, setPostureResult] = useState<PostureScoreJobResult | null>(null);
  const [postureError, setPostureError] = useState<string | null>(null);
  const [postureJobId, setPostureJobId] = useState<string | null>(null);

  // ── Attack Mind state ─────────────────────────────────────────────────────
  const hasAttackMind = !!onRunAttackMind && !isReadOnly;
  const [attackState, setAttackState] = useState<AttackState>('idle');
  const [attackResult, setAttackResult] = useState<AttackMindJobResult | null>(null);
  const [attackError, setAttackError] = useState<string | null>(null);
  const [attackJobId, setAttackJobId] = useState<string | null>(null);
  const [attackEntryPointNodeId, setAttackEntryPointNodeId] = useState<string>('');
  const [attackUseExtended, setAttackUseExtended] = useState(false);
  const [postureUseExtended, setPostureUseExtended] = useState(false);

  // ── AI Assistant helpers ─────────────────────────────────────────────────
  const pushMsg = (msg: Message) => setMessages((prev) => [...prev, msg]);
  const replaceLastMsg = (msg: Message) =>
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = msg;
      return updated;
    });

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
      const summary = `Found **${threats.length}** threat${threats.length !== 1 ? 's' : ''}. Review in the **Threat Model panel** (⌘⇧M) and save as a named model if you want to keep this analysis.`;
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
    if (isReadOnly) {
      await runStreaming(trimmed, trimmed);
      return;
    }
    pushMsg({ role: 'user', content: trimmed });
    if (hasNodes && onGeneratePreview && onApplyGeneratedDiagram) {
      pushMsg({ role: 'assistant', content: '', isLoading: true });
      try {
        const result = await onGeneratePreview(trimmed);
        setPendingDiagram(result);
        replaceLastMsg({
          role: 'assistant',
          content: `Generated **${result.nodes.length} component${result.nodes.length !== 1 ? 's' : ''}**. Where would you like to add this?`,
        });
      } catch {
        replaceLastMsg({ role: 'assistant', content: 'Sorry, generation failed. Please try again.' });
      }
      return;
    }
    await runGenerate(trimmed);
  };

  const handleCurrentLayer = async () => {
    if (!pendingDiagram || !onApplyGeneratedDiagram) return;
    const diagram = pendingDiagram;
    setPendingDiagram(null);
    pushMsg({ role: 'assistant', content: '', isLoading: true });
    try {
      await onApplyGeneratedDiagram(diagram.nodes, diagram.edges);
      replaceLastMsg({ role: 'assistant', content: 'Done! Diagram applied to the current layer.' });
    } catch {
      replaceLastMsg({ role: 'assistant', content: 'Failed to apply diagram. Please try again.' });
    }
  };

  const handleNewLayer = async () => {
    if (!pendingDiagram || !onApplyGeneratedDiagram) return;
    const diagram = pendingDiagram;
    setPendingDiagram(null);
    const lName = `AI Layer ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    pushMsg({ role: 'assistant', content: '', isLoading: true });
    try {
      await onApplyGeneratedDiagram(diagram.nodes, diagram.edges, lName);
      replaceLastMsg({ role: 'assistant', content: `Done! Diagram applied to new layer **"${lName}"**.` });
    } catch {
      replaceLastMsg({ role: 'assistant', content: 'Failed to create layer. Please try again.' });
    }
  };

  // ── Threat agent helpers ──────────────────────────────────────────────────

  const pushThreatMsg = (msg: ThreatMessage) =>
    setThreatMessages((prev) => [...prev, msg]);

  const replaceThreatMsg = (index: number, msg: ThreatMessage) =>
    setThreatMessages((prev) => {
      const updated = [...prev];
      updated[index] = msg;
      return updated;
    });

  // Runs the agent for an initial "Analyze" click or a follow-up user reply.
  // `userContent` is the text the user typed (undefined on first/auto turn).
  const runThreatAgent = async (userContent?: string) => {
    if (!onThreatAgentChat || !projectId || !diagramId || !layerId) return;
    if (threatState === 'analyzing') return; // job in flight

    // Add the user message to the thread (if user typed something)
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = threatMessages
      .filter((m) => m.msgType === 'text' || !m.msgType)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    if (userContent) {
      pushThreatMsg({ role: 'user', content: userContent, msgType: 'text' });
      history.push({ role: 'user', content: userContent });
    }

    // Add loading assistant message
    setThreatMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', msgType: 'text', isLoading: true } as ThreatMessage & { isLoading: boolean },
    ]);
    const assistantIdx = threatMessages.length + (userContent ? 1 : 0);

    setThreatState(userContent ? 'conversing' : 'diagnosing');

    const payload: ThreatChatPayload = {
      projectId,
      diagramId,
      layerId,
      layerName,
      messages: history,
      nodes: (diagramNodes ?? []) as ThreatChatPayload['nodes'],
      edges: (diagramEdges ?? []) as ThreatChatPayload['edges'],
      trustBoundaries: (diagramTrustBoundaries ?? []) as ThreatChatPayload['trustBoundaries'],
    };

    let assistantContent = '';
    let progressCardIdx = -1;

    try {
      for await (const event of onThreatAgentChat(payload)) {
        switch (event.type) {
          case 'message':
            assistantContent += event.delta;
            replaceThreatMsg(assistantIdx, { role: 'assistant', content: assistantContent, msgType: 'text' });
            setThreatState('conversing');
            break;

          case 'message_done':
            // Finalize assistant message
            replaceThreatMsg(assistantIdx, { role: 'assistant', content: assistantContent, msgType: 'text' });
            break;

          case 'analysis_triggered':
            // Add a phase divider + progress card
            setThreatMessages((prev) => [
              ...prev,
              { role: 'system', content: 'Diagram analyzed · running threat model', msgType: 'divider' },
              { role: 'system', content: '', msgType: 'progress', jobId: event.jobId },
            ]);
            progressCardIdx = assistantIdx + 2; // approximate — we'll scan by type
            setThreatState('analyzing');
            break;

          case 'analysis_complete':
            // Replace progress card with result card
            setThreatMessages((prev) => {
              const updated = [...prev];
              const idx = updated.findLastIndex((m) => m.msgType === 'progress');
              if (idx !== -1) {
                updated[idx] = {
                  role: 'system',
                  content: '',
                  msgType: 'result',
                  analysisResult: {
                    modelId: event.modelId,
                    threatCount: event.threatCount,
                    summary: event.summary,
                    keyFindings: event.keyFindings,
                  },
                };
              }
              return updated;
            });
            setThreatState('complete');
            break;

          case 'error':
            setThreatMessages((prev) => [
              ...prev,
              { role: 'system', content: event.message, msgType: 'text' },
            ]);
            setThreatState('conversing');
            break;
        }
      }
    } catch {
      setThreatMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant' && !updated[lastIdx].content) {
          updated[lastIdx] = { role: 'assistant', content: 'Something went wrong. Please try again.', msgType: 'text' };
        }
        return updated;
      });
      setThreatState('conversing');
    }
    void progressCardIdx; // suppress unused warning
  };

  const handleThreatSubmit = async () => {
    const trimmed = threatInput.trim();
    if (!trimmed || threatState === 'diagnosing' || threatState === 'analyzing') return;
    setThreatInput('');
    await runThreatAgent(trimmed);
  };

  const handleNewThreatSession = () => {
    setThreatMessages([]);
    setThreatState('idle');
    setThreatInput('');
  };

  const runPostureScore = async () => {
    if (!onRunPostureScore || !projectId || !diagramId) return;
    if (postureState === 'submitting' || postureState === 'running') return;
    setPostureState('submitting');
    setPostureResult(null);
    setPostureError(null);
    try {
      for await (const event of onRunPostureScore({
        projectId,
        diagramId,
        diagramVersion: diagramVersion ?? 1,
        layers: diagramLayers,
        useExtendedThinking: postureUseExtended,
      })) {
        if (event.event === 'job_submitted') {
          setPostureJobId(event.jobId);
          setPostureState('running');
        } else if (event.event === 'job_complete') {
          setPostureResult(event.data);
          setPostureState('complete');
        } else if (event.event === 'error') {
          setPostureError(event.message);
          setPostureState('error');
        }
      }
    } catch (err) {
      setPostureError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setPostureState('error');
    }
    void postureJobId;
  };

  const runAttackMind = async () => {
    if (!onRunAttackMind || !projectId || !diagramId) return;
    if (attackState === 'submitting' || attackState === 'running') return;
    setAttackState('submitting');
    setAttackResult(null);
    setAttackError(null);
    try {
      for await (const event of onRunAttackMind({
        projectId,
        diagramId,
        diagramVersion: diagramVersion ?? 1,
        layers: diagramLayers,
        entryPointNodeId: attackEntryPointNodeId || undefined,
        useExtendedThinking: attackUseExtended,
      })) {
        if (event.event === 'job_submitted') {
          setAttackJobId(event.jobId);
          setAttackState('running');
        } else if (event.event === 'job_complete') {
          setAttackResult(event.data);
          setAttackState('complete');
        } else if (event.event === 'error') {
          setAttackError(event.message);
          setAttackState('error');
        }
      }
    } catch (err) {
      setAttackError(err instanceof Error ? err.message : 'Simulation failed. Please try again.');
      setAttackState('error');
    }
    void attackJobId;
  };

  const examples = isReadOnly ? EXAMPLES_QA : EXAMPLES_GENERATE;
  const placeholder = isReadOnly
    ? 'Ask about this architecture… (Enter to send)'
    : 'Describe a diagram… (Enter to send)';
  const isBusy = isLoading || isEvaluating || isAnalyzingThreats;

  const threatHasHistory = threatMessages.length > 0;
  const threatBusy = threatState === 'diagnosing' || threatState === 'analyzing';
  const threatCanType = threatState === 'conversing' || threatState === 'complete';

  return (
    <aside className="relative flex h-full w-[420px] flex-shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 flex-col border-b border-slate-200 dark:border-slate-700">
        {/* Top row: icon + title + controls */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-200 dark:bg-slate-700 dark:ring-slate-600">
            {activeTab === 'threat'
              ? <Shield size={13} className="text-red-500" />
              : activeTab === 'posture'
              ? <BarChart2 size={13} className="text-purple-500" />
              : activeTab === 'attack'
              ? <Cpu size={13} className="text-orange-500" />
              : <Sparkles size={13} className="text-blue-600 dark:text-blue-400" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {activeTab === 'threat' ? 'Threat Intelligence' : activeTab === 'posture' ? 'Security Posture' : activeTab === 'attack' ? 'Attack Mind' : 'AI Assistant'}
              </span>
              {isReadOnly && (
                <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  <Lock size={8} />
                  View only
                </span>
              )}
              {activeTab === 'threat' && threatHasHistory && (
                <button
                  onClick={handleNewThreatSession}
                  className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  title="Start new session (history preserved)"
                >
                  + New
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {activeTab === 'threat'
                ? (threatHasHistory ? 'Session from this diagram' : 'STRIDE · OWASP · Agentic AI')
                : activeTab === 'posture'
                ? 'Architecture security scoring'
                : activeTab === 'attack'
                ? 'APT simulation · MITRE ATT&CK'
                : (isReadOnly ? 'Evaluation & Q&A mode' : 'Diagram Generation · Claude')
              }
            </div>
          </div>

          {/* History button (AI tab, cloud only) */}
          {activeTab === 'ai' && projectId && onThreatAnalysis && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              title="Saved threat models"
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${showHistory ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'}`}
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

        {/* Tab bar — only shown if threat agent, posture, or attack mind is available */}
        {(hasThreatAgent || hasPostureScore || hasAttackMind) && (
          <div className="flex border-t border-slate-100 dark:border-slate-700/60">
            <button
              onClick={() => { setActiveTab('ai'); setShowHistory(false); }}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                activeTab === 'ai'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles size={11} />
              AI Assistant
            </button>
            {hasThreatAgent && (
              <button
                onClick={() => { setActiveTab('threat'); setShowHistory(false); }}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'threat'
                    ? 'border-b-2 border-red-500 text-red-600 dark:text-red-400'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Shield size={11} />
                Threat Analysis
              </button>
            )}
            {hasPostureScore && (
              <button
                onClick={() => { setActiveTab('posture'); setShowHistory(false); }}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'posture'
                    ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <BarChart2 size={11} />
                Posture
              </button>
            )}
            {hasAttackMind && (
              <button
                onClick={() => { setActiveTab('attack'); setShowHistory(false); }}
                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  activeTab === 'attack'
                    ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Cpu size={11} />
                Attack Mind
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          AI ASSISTANT TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <>
          {/* Threat History view */}
          {showHistory && projectId && (
            <ThreatHistoryPanel
              projectId={projectId}
              isDark={isDark}
              onBack={() => setShowHistory(false)}
            />
          )}

          {/* Messages */}
          {!showHistory && (
            <div className="relative flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-5">
                {primer && (
                  <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                    <Info size={12} className="mt-0.5 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-600 dark:text-slate-300">Context attached</div>
                      <div className="truncate text-slate-500 dark:text-slate-400" title={primer.content}>
                        {primerLabel(primer)}
                      </div>
                    </div>
                  </div>
                )}
                {messages.map((msg, i) =>
                  msg.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-3">
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-200 dark:bg-slate-700 dark:ring-slate-600">
                        <Sparkles size={11} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">
                        {(msg as Message & { isLoading?: boolean }).isLoading ? (
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

                {/* Pending diagram preview */}
                {pendingDiagram && !isLoading && (
                  <div className="flex flex-col gap-2 pl-9">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {pendingDiagram.nodes.length} components · {pendingDiagram.edges.length} connections
                        </span>
                      </div>
                      <div className="h-[180px]">
                        <MiniDiagramPreview nodes={pendingDiagram.nodes} edges={pendingDiagram.edges} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers size={12} className="flex-shrink-0 text-slate-400" />
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Add to:</span>
                      <button
                        onClick={handleCurrentLayer}
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500"
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
            </div>
          )}

          {/* Input footer */}
          {!showHistory && (
            <div className="relative flex-shrink-0 space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
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
                  {onThreatAnalysis && !isReadOnly && !hasThreatAgent && (
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
                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
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
                  disabled={isBusy || (!isReadOnly && !!pendingDiagram)}
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-slate-500"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isBusy || (!isReadOnly && !!pendingDiagram)}
                  className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          THREAT ANALYSIS TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'threat' && (
        <>
          {/* Messages thread */}
          <div className="relative flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">

              {/* Idle / empty state */}
              {!threatHasHistory && threatState === 'idle' && (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-200 dark:bg-slate-800 dark:ring-slate-600">
                    <Shield size={24} className="text-red-500" />
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Threat Intelligence Agent
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Analyzes your diagram for security threats using STRIDE, OWASP LLM Top 10, and Agentic AI Top 10.
                    </div>
                  </div>
                  <button
                    onClick={() => runThreatAgent()}
                    disabled={!hasNodes || threatBusy}
                    className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
                  >
                    <Shield size={14} />
                    Analyze Threats
                  </button>
                  {!hasNodes && (
                    <p className="text-xs text-slate-400">Add nodes to the diagram first</p>
                  )}
                </div>
              )}

              {/* Threat messages */}
              {threatMessages.map((msg, i) => {
                if (msg.msgType === 'divider') {
                  return (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                      <span className="whitespace-nowrap text-[10px] text-slate-400 dark:text-slate-500">
                        {msg.content}
                      </span>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </div>
                  );
                }

                if (msg.msgType === 'progress' || msg.msgType === 'result') {
                  return (
                    <div key={i} className="pl-9">
                      <ThreatProgressCard result={msg.analysisResult} />
                    </div>
                  );
                }

                if (msg.role === 'user') {
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-2.5 text-sm leading-relaxed text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                // assistant text
                return (
                  <div key={i} className="flex gap-3">
                    <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 ring-1 ring-red-200 dark:bg-slate-700 dark:ring-slate-600">
                      <Shield size={11} className="text-red-500" />
                    </div>
                    <div className="min-w-0 flex-1 text-slate-800 dark:text-slate-200">
                      {(msg as ThreatMessage & { isLoading?: boolean }).isLoading ? (
                        <ThinkingDots
                          label={
                            threatState === 'diagnosing'
                              ? 'Analyzing your diagram…'
                              : threatState === 'analyzing'
                              ? 'Running threat model…'
                              : 'Thinking…'
                          }
                        />
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                );
              })}

              <div ref={threatMessagesEndRef} />
            </div>
          </div>

          {/* Threat footer */}
          <div className="relative flex-shrink-0 space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
            {/* Quick-action chips */}
            {threatState === 'idle' && threatHasHistory && (
              <div className="flex gap-2">
                <button
                  onClick={() => runThreatAgent()}
                  disabled={!hasNodes}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-400/20 dark:text-red-400 disabled:opacity-40"
                >
                  <Shield size={12} />
                  Analyze Threats
                </button>
              </div>
            )}

            {threatState === 'complete' && (
              <div className="flex gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('layers:open-threat-panel'))}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                >
                  View Threat Model
                </button>
                <button
                  onClick={() => { handleNewThreatSession(); }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 bg-red-400/10 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-400/20 dark:text-red-400"
                >
                  <Shield size={12} />
                  Re-analyze
                </button>
              </div>
            )}

            {/* Input area — shown when conversation is active */}
            {(threatCanType || threatBusy) && (
              <div className="flex items-end gap-2">
                <textarea
                  ref={threatTextareaRef}
                  value={threatInput}
                  onChange={(e) => setThreatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleThreatSubmit();
                    }
                  }}
                  placeholder={
                    threatBusy
                      ? 'Analysis in progress…'
                      : 'Reply to the agent… (Enter to send)'
                  }
                  rows={2}
                  disabled={threatBusy}
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder-slate-400 focus:border-red-400 focus:ring-1 focus:ring-red-400/30 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                />
                <button
                  onClick={handleThreatSubmit}
                  disabled={!threatInput.trim() || threatBusy}
                  className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {threatBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
            )}
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-500">
              {threatState === 'idle'
                ? 'AI analyzes diagram · asks 1–3 questions · runs threat model'
                : 'Enter to send · Shift+Enter for new line'}
            </p>
          </div>
        </>
      )}
      {/* ═══════════════════════════════════════════════════════════════════════
          POSTURE SCORE TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'posture' && (
        <>
          <div className="relative flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {projectId && diagramId && (
                <PipelineNudge
                  projectId={projectId}
                  diagramId={diagramId}
                  diagramVersion={diagramVersion ?? 1}
                  diagramLayers={diagramLayers}
                  threatNodes={diagramNodes ?? []}
                  threatEdges={diagramEdges ?? []}
                  layerId={layerId ?? 'root'}
                  layerName={layerName}
                  onShowSecurityIntel={onShowSecurityIntel}
                  onPhaseChange={onPipelinePhaseChange}
                  isDark={isDark}
                />
              )}
              {/* Idle state */}
              {postureState === 'idle' && (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 ring-1 ring-purple-200 dark:bg-slate-800 dark:ring-slate-600">
                    <BarChart2 size={24} className="text-purple-500" />
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Security Posture Score</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      AI-powered security architecture scoring across 6 CISSP dimensions. Scores 0–100 with actionable recommendations.
                    </div>
                  </div>
                </div>
              )}

              {/* Progress / result card */}
              {(postureState === 'submitting' || postureState === 'running') && (
                <PostureProgressCard />
              )}
              {postureState === 'complete' && postureResult && (
                <PostureProgressCard result={postureResult} />
              )}
              {postureState === 'error' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
                  {postureError ?? 'Analysis failed. Please try again.'}
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
            {/* Extended thinking toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={postureUseExtended}
                onChange={e => setPostureUseExtended(e.target.checked)}
                className="h-3 w-3 rounded border-slate-300 text-purple-600"
                disabled={postureState === 'submitting' || postureState === 'running'}
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Extended thinking (slower, deeper analysis)</span>
            </label>

            {postureState === 'complete' ? (
              <div className="space-y-1.5">
                <button
                  onClick={() => { setPostureState('idle'); setPostureResult(null); setPostureError(null); }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-purple-400/30 bg-purple-400/10 py-2 text-xs font-medium text-purple-600 transition hover:bg-purple-400/20 dark:text-purple-400"
                >
                  <BarChart2 size={12} />
                  Re-score
                </button>
                {onShowSecurityIntel && (
                  <button
                    onClick={onShowSecurityIntel}
                    className="flex w-full items-center justify-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 dark:text-blue-400"
                  >
                    View Security Intel →
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={runPostureScore}
                disabled={!hasNodes || postureState === 'submitting' || postureState === 'running'}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 py-2 text-xs font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
              >
                {(postureState === 'submitting' || postureState === 'running')
                  ? <><Loader2 size={12} className="animate-spin" /> Analyzing…</>
                  : <><BarChart2 size={12} /> Score Architecture</>
                }
              </button>
            )}
            {!hasNodes && <p className="text-center text-[10px] text-slate-400">Add nodes to the diagram first</p>}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ATTACK MIND TAB
      ════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'attack' && (
        <>
          <div className="relative flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {/* Idle state */}
              {attackState === 'idle' && (
                <div className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 ring-1 ring-orange-200 dark:bg-slate-800 dark:ring-slate-600">
                    <Cpu size={24} className="text-orange-500" />
                  </div>
                  <div>
                    <div className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Attack Mind</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Simulates an APT adversary against your architecture. Maps attack paths using MITRE ATT&amp;CK and CISSP principles.
                    </div>
                  </div>
                </div>
              )}

              {/* Progress / result card */}
              {(attackState === 'submitting' || attackState === 'running') && (
                <AttackMindProgressCard />
              )}
              {attackState === 'complete' && attackResult && (
                <AttackMindProgressCard result={attackResult} />
              )}
              {attackState === 'error' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
                  {attackError ?? 'Simulation failed. Please try again.'}
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
            {/* Entry point dropdown */}
            {attackState === 'idle' || attackState === 'error' ? (
              <div className="relative">
                <select
                  value={attackEntryPointNodeId}
                  onChange={e => setAttackEntryPointNodeId(e.target.value)}
                  disabled={false}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                >
                  <option value="">Auto-select entry point</option>
                  {(diagramNodes ?? [])
                    .filter(n => n.type !== 'line' && n.type !== 'arrowline' && n.type !== 'dottedline' && n.type !== 'trustboundary')
                    .map(n => (
                      <option key={n.id} value={n.id}>{n.label ?? n.id}</option>
                    ))}
                </select>
                <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            ) : null}

            {/* Extended thinking toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={attackUseExtended}
                onChange={e => setAttackUseExtended(e.target.checked)}
                className="h-3 w-3 rounded border-slate-300 text-orange-600"
                disabled={attackState === 'submitting' || attackState === 'running'}
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Extended thinking (slower, deeper analysis)</span>
            </label>

            {attackState === 'complete' ? (
              <div className="space-y-1.5">
                <button
                  onClick={() => { setAttackState('idle'); setAttackResult(null); setAttackError(null); }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-orange-400/30 bg-orange-400/10 py-2 text-xs font-medium text-orange-600 transition hover:bg-orange-400/20 dark:text-orange-400"
                >
                  <Cpu size={12} />
                  Re-simulate
                </button>
                {onShowSecurityIntel && (
                  <button
                    onClick={onShowSecurityIntel}
                    className="flex w-full items-center justify-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 dark:text-blue-400"
                  >
                    View Security Intel →
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={runAttackMind}
                disabled={!hasNodes || attackState === 'submitting' || attackState === 'running'}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2 text-xs font-medium text-white transition hover:bg-orange-500 disabled:opacity-50"
              >
                {(attackState === 'submitting' || attackState === 'running')
                  ? <><Loader2 size={12} className="animate-spin" /> Simulating…</>
                  : <><Cpu size={12} /> Run Attack Mind</>
                }
              </button>
            )}
            {!hasNodes && <p className="text-center text-[10px] text-slate-400">Add nodes to the diagram first</p>}
          </div>
        </>
      )}
    </aside>
  );
}
