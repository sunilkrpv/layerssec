'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Shield, ArrowLeft, Layers, Sun, Moon, Monitor, LogOut, User,
  Sparkles, ChevronDown, ChevronRight, ChevronUp, BarChart2, Cpu, ListChecks,
  Clipboard, ClipboardCheck, FileText, Loader2, AlertCircle, AlertTriangle,
  Swords, CheckCircle2, ArrowRight,
} from 'lucide-react';
import {
  apiGetProject, apiListThreatModels, apiGetThreatModel,
  apiGetPostureScoreHistory, apiListAttackSimulations,
  apiIntelSynthesis, apiExportIntelReport,
  ApiUnauthorizedError,
  type ThreatModelSummary, type ThreatModelFull,
  type PostureScoreHistoryItem, type AttackSimulation,
  type IntelSynthesisResult, type PriorityAction,
  type ThreatSeverity, type ThreatStatus,
  type AttackPath,
} from '@/lib/api';
import { getStoredUser, clearTokens } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type IntelState = 'loading_sources' | 'ready' | 'synthesizing' | 'complete' | 'error';

interface RiskLevel {
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  color: string;
  bg: string;
  border: string;
  textColor: string;
}

// ── Risk algorithm ────────────────────────────────────────────────────────────

function computeCompositeRisk(
  threatModel: ThreatModelFull | null,
  postureScore: PostureScoreHistoryItem | null,
  hasAttackSim: boolean,
): RiskLevel {
  const threats = threatModel?.threats ?? [];
  const active = threats.filter(
    (t) => (t.status as ThreatStatus) !== 'MITIGATED' && (t.status as ThreatStatus) !== 'FALSE_POSITIVE',
  );
  const criticalCount = active.filter((t) => t.severity === 'CRITICAL').length;
  const highCount = active.filter((t) => t.severity === 'HIGH').length;
  const mediumCount = active.filter((t) => t.severity === 'MEDIUM').length;
  const lowCount = active.filter((t) => t.severity === 'LOW').length;
  const threatScore = Math.min(100, criticalCount * 40 + highCount * 20 + mediumCount * 5 + lowCount * 1);
  const postureRisk = postureScore ? 100 - postureScore.score : 50;
  const attackModifier = hasAttackSim ? 10 : 0;
  const composite = threatScore * 0.45 + postureRisk * 0.35 + attackModifier * 0.2;
  if (composite >= 70) return { level: 'CRITICAL', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', textColor: '#dc2626' };
  if (composite >= 45) return { level: 'HIGH', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', textColor: '#ea580c' };
  if (composite >= 20) return { level: 'MEDIUM', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', textColor: '#d97706' };
  return { level: 'LOW', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', textColor: '#059669' };
}

// ── Severity + source badge helpers ──────────────────────────────────────────

const SEV_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const SRC_CLS: Record<string, string> = {
  threat: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  posture: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  attack: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

const THREAT_SEV_BADGE: Record<ThreatSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  LOW: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  INFO: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700">
      <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
    </div>
  );
}

function CollapsiblePanel({
  title, icon, badge, children,
}: {
  title: string; icon: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <SectionCard>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
      >
        <span className="text-slate-400 dark:text-slate-500">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
        {badge}
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {open && <div className="border-t border-slate-100 dark:border-slate-700">{children}</div>}
    </SectionCard>
  );
}

// ── Attack Surface Panel ──────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CRITICAL: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800', dot: 'bg-red-500' },
  HIGH:     { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' },
  MEDIUM:   { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', dot: 'bg-amber-400' },
  LOW:      { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-600', dot: 'bg-slate-400' },
};

const LIKELIHOOD_LABEL: Record<string, { label: string; color: string }> = {
  HIGH:   { label: 'High likelihood', color: 'text-red-500 dark:text-red-400' },
  MEDIUM: { label: 'Medium likelihood', color: 'text-amber-500 dark:text-amber-400' },
  LOW:    { label: 'Low likelihood', color: 'text-slate-400 dark:text-slate-500' },
};

function parseAttackPaths(sim: AttackSimulation): AttackPath[] | null {
  const content = (sim as unknown as { content?: string }).content;
  if (!content) {
    if (sim.paths) return sim.paths as AttackPath[];
    return null;
  }
  try {
    const cleaned = content.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed as AttackPath[];
    if (parsed && Array.isArray((parsed as { paths?: unknown[] }).paths)) return (parsed as { paths: AttackPath[] }).paths;
    return null;
  } catch {
    return null;
  }
}

function AttackPathCard({ path, index }: { path: AttackPath; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_COLORS[path.severity] ?? SEVERITY_COLORS.MEDIUM;
  const lh = LIKELIHOOD_LABEL[path.likelihood] ?? LIKELIHOOD_LABEL.MEDIUM;
  return (
    <div className={`rounded-xl border ${sev.border} ${sev.bg}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        {/* Index circle */}
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${sev.dot}`}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-semibold ${sev.text}`}>{path.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className={`text-xs font-medium uppercase tracking-wide ${sev.text}`}>{path.severity}</span>
            <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
            <span className={`text-xs ${lh.color}`}>{lh.label}</span>
            {path.entryPointLabel && (
              <>
                <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Entry: <span className="font-medium">{path.entryPointLabel}</span></span>
              </>
            )}
            <span className="text-xs text-slate-300 dark:text-slate-600">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{path.steps.length} steps</span>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={13} className="mt-0.5 shrink-0 text-slate-400" />
          : <ChevronDown size={13} className="mt-0.5 shrink-0 text-slate-400" />}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-slate-200/60 px-4 pb-4 pt-3 dark:border-slate-700/60 space-y-4">
          {/* Summary */}
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{path.summary}</p>

          {/* Kill chain steps */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Kill Chain</p>
            <div className="space-y-0">
              {path.steps.map((step, si) => {
                const stepSev = SEVERITY_COLORS[step.successLikelihood] ?? SEVERITY_COLORS.MEDIUM;
                return (
                  <div key={si} className="flex gap-3">
                    {/* Connector line + node */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-600 dark:text-slate-200`}>
                        {step.stepNumber}
                      </div>
                      {si < path.steps.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />
                      )}
                    </div>
                    {/* Step content */}
                    <div className="pb-3 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{step.action}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${stepSev.bg} ${stepSev.text}`}>
                          {step.successLikelihood}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">{step.attackTechnique}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mitigations */}
          {path.mitigations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recommended Mitigations</p>
              <ul className="space-y-1">
                {path.mitigations.map((m, mi) => (
                  <li key={mi} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttackSurfacePanel({ sim }: { sim: AttackSimulation }) {
  const paths = parseAttackPaths(sim);
  const entryPoint = (sim as unknown as { entryPointNodeId?: string }).entryPointNodeId;
  const criticalCount = paths?.filter((p) => p.severity === 'CRITICAL').length ?? 0;
  const highCount = paths?.filter((p) => p.severity === 'HIGH').length ?? 0;

  return (
    <CollapsiblePanel
      title="Attack Surface"
      icon={<Swords size={14} />}
      badge={
        paths && paths.length > 0 ? (
          <div className="mr-2 flex items-center gap-1.5">
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {criticalCount} critical
              </span>
            )}
            {highCount > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                {highCount} high
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {paths.length} path{paths.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : entryPoint ? (
          <span className="mr-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
            Entry: {entryPoint}
          </span>
        ) : null
      }
    >
      <div className="p-4 space-y-3">
        {paths && paths.length > 0 ? (
          paths.map((path, i) => (
            <AttackPathCard key={path.pathId ?? i} path={path} index={i} />
          ))
        ) : (
          /* Narrative fallback for plain-markdown sims */
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {((sim as unknown as { content?: string }).content ?? '')}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </CollapsiblePanel>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-2">
        <div className="h-3 rounded bg-slate-100 dark:bg-slate-700/60" />
        <div className="h-3 w-4/5 rounded bg-slate-100 dark:bg-slate-700/60" />
        <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-700/60" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { projectId: string }

export default function SecurityIntelPage({ projectId }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const storedUser = getStoredUser();

  // ── Source data ──────────────────────────────────────────────────────────
  const [threatModels, setThreatModels] = useState<ThreatModelSummary[]>([]);
  const [postureScores, setPostureScores] = useState<PostureScoreHistoryItem[]>([]);
  const [attackSims, setAttackSims] = useState<AttackSimulation[]>([]);
  const [projectName, setProjectName] = useState('');

  // ── Selected inputs ──────────────────────────────────────────────────────
  const [selectedThreatModelId, setSelectedThreatModelId] = useState('');
  const [selectedPostureScoreId, setSelectedPostureScoreId] = useState('');
  const [selectedAttackSimId, setSelectedAttackSimId] = useState('');

  // ── Loaded detail data ───────────────────────────────────────────────────
  const [currentThreatModel, setCurrentThreatModel] = useState<ThreatModelFull | null>(null);
  const [currentPostureScore, setCurrentPostureScore] = useState<PostureScoreHistoryItem | null>(null);
  const [currentAttackSim, setCurrentAttackSim] = useState<AttackSimulation | null>(null);

  // ── Synthesis ────────────────────────────────────────────────────────────
  const [synthesis, setSynthesis] = useState<IntelSynthesisResult | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Page state ───────────────────────────────────────────────────────────
  const [intelState, setIntelState] = useState<IntelState>('loading_sources');
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // ── Load sources on mount ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiGetProject(projectId),
      apiListThreatModels(projectId).catch(() => [] as ThreatModelSummary[]),
      apiGetPostureScoreHistory(projectId).catch(() => [] as PostureScoreHistoryItem[]),
      apiListAttackSimulations(projectId).catch(() => [] as AttackSimulation[]),
    ])
      .then(([project, tms, ps, as_]) => {
        setProjectName(project.name);
        setThreatModels(tms);
        setPostureScores(ps);
        setAttackSims(as_);
        if (tms.length > 0) setSelectedThreatModelId(tms[0].id);
        if (ps.length > 0) setSelectedPostureScoreId(ps[0].id);
        if (as_.length > 0) setSelectedAttackSimId(as_[0].id);
        setIntelState('ready');
      })
      .catch((err) => {
        if (err instanceof ApiUnauthorizedError) { router.push('/projects'); return; }
        setError('Failed to load security analysis data.');
        setIntelState('error');
      });
  }, [projectId, router]);

  // ── Load full threat model when selection changes ─────────────────────────
  useEffect(() => {
    if (!selectedThreatModelId) { setCurrentThreatModel(null); return; }
    setSynthesis(null);
    apiGetThreatModel(selectedThreatModelId).then(setCurrentThreatModel).catch(() => {});
  }, [selectedThreatModelId]);

  // ── Load posture score detail when selection changes ─────────────────────
  useEffect(() => {
    const found = postureScores.find((p) => p.id === selectedPostureScoreId) ?? null;
    setCurrentPostureScore(found);
    if (selectedPostureScoreId) setSynthesis(null);
  }, [selectedPostureScoreId, postureScores]);

  // ── Load attack sim when selection changes ────────────────────────────────
  useEffect(() => {
    const found = attackSims.find((a) => a.id === selectedAttackSimId) ?? null;
    setCurrentAttackSim(found);
    if (selectedAttackSimId) setSynthesis(null);
  }, [selectedAttackSimId, attackSims]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const canGenerate = !!selectedThreatModelId && !!selectedPostureScoreId && intelState !== 'synthesizing';

  async function handleGenerateIntel() {
    if (!canGenerate) return;
    setIntelState('synthesizing');
    setError(null);
    try {
      const result = await apiIntelSynthesis({
        projectId,
        threatModelId: selectedThreatModelId,
        postureScoreId: selectedPostureScoreId,
        attackSimulationId: selectedAttackSimId || undefined,
      });
      setSynthesis(result);
      setIntelState('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed. Please try again.');
      setIntelState('ready');
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      await apiExportIntelReport({
        projectId,
        threatModelId: selectedThreatModelId,
        postureScoreId: selectedPostureScoreId,
        attackSimulationId: selectedAttackSimId || undefined,
        executiveSummary: synthesis?.executiveSummary,
        priorityActions: synthesis?.priorityActions,
      });
    } catch { /* silent */ } finally {
      setExportingPdf(false);
    }
  }

  function handleCopySummary() {
    if (!synthesis?.executiveSummary) return;
    navigator.clipboard.writeText(synthesis.executiveSummary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    setTheme(cycle[(cycle.indexOf(theme) + 1) % cycle.length]);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const risk = computeCompositeRisk(currentThreatModel, currentPostureScore, !!currentAttackSim);
  const activeThreats = (currentThreatModel?.threats ?? []).filter(
    (t) => (t.status as ThreatStatus) !== 'MITIGATED' && (t.status as ThreatStatus) !== 'FALSE_POSITIVE',
  );
  const countBySev = (sev: ThreatSeverity) => activeThreats.filter((t) => t.severity === sev).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <Layers size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Drafter</span>
        </div>

        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ArrowLeft size={13} />
          Back to diagram
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-1.5">
          <Shield size={12} className="text-indigo-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {projectName ? `${projectName} — Security Intel` : 'Security Intel'}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {selectedThreatModelId && selectedPostureScoreId && (
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white disabled:opacity-50"
            >
              {exportingPdf
                ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                : <><FileText size={12} /> Export PDF</>}
            </button>
          )}

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          <button
            onClick={cycleTheme}
            title={`Theme: ${theme}`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {storedUser && (
            <button
              onClick={() => { clearTokens(); router.push('/projects/local'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">
                {storedUser.email}
              </span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">

          {/* Loading */}
          {intelState === 'loading_sources' && (
            <div className="flex items-center justify-center py-20 text-sm text-slate-400 dark:text-slate-500">
              <Loader2 size={16} className="mr-2 animate-spin" /> Loading security analyses…
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {intelState !== 'loading_sources' && (
            <>
              {/* ── Data Source Bar ─────────────────────────────────────── */}
              <SectionCard className="p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Threat Model */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Threat Model
                    </label>
                    {threatModels.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        No saved threat models.{' '}
                        <button onClick={() => router.push(`/projects/${projectId}`)} className="text-indigo-500 underline">
                          Run STRIDE analysis
                        </button>
                      </p>
                    ) : (
                      <select
                        value={selectedThreatModelId}
                        onChange={(e) => setSelectedThreatModelId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        {threatModels.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name} ({tm.threatCount} threats)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Posture Score */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Posture Score
                    </label>
                    {postureScores.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        No posture scores.{' '}
                        <button onClick={() => router.push(`/projects/${projectId}`)} className="text-indigo-500 underline">
                          Run posture analysis
                        </button>
                      </p>
                    ) : (
                      <select
                        value={selectedPostureScoreId}
                        onChange={(e) => setSelectedPostureScoreId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        {postureScores.map((ps) => (
                          <option key={ps.id} value={ps.id}>
                            Score {ps.score} — {new Date(ps.analyzedAt).toLocaleDateString()}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Attack Mind */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Attack Mind <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    {attackSims.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        No simulations.{' '}
                        <button onClick={() => router.push(`/projects/${projectId}`)} className="text-indigo-500 underline">
                          Run Attack Mind
                        </button>
                      </p>
                    ) : (
                      <select
                        value={selectedAttackSimId}
                        onChange={(e) => setSelectedAttackSimId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        <option value="">— Not included —</option>
                        {attackSims.map((as) => (
                          <option key={as.id} value={as.id}>
                            {as.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleGenerateIntel}
                    disabled={!canGenerate || threatModels.length === 0 || postureScores.length === 0}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {intelState === 'synthesizing' ? (
                      <><Loader2 size={14} className="animate-spin" /> Synthesizing…</>
                    ) : (
                      <><Sparkles size={14} /> Generate Security Intel</>
                    )}
                  </button>
                </div>
              </SectionCard>

              {/* ── Hero Row ─────────────────────────────────────────────── */}
              {(currentThreatModel || currentPostureScore) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Composite risk */}
                  <SectionCard className={`p-5 ${risk.bg} ${risk.border}`}>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Overall Risk
                    </p>
                    <p className={`text-3xl font-bold ${risk.color}`}>{risk.level}</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Composite across {[currentThreatModel && 'threats', currentPostureScore && 'posture', currentAttackSim && 'attack'].filter(Boolean).join(' · ')}
                    </p>
                  </SectionCard>

                  {/* Posture score */}
                  <SectionCard className="p-5">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Posture Score
                    </p>
                    {currentPostureScore ? (
                      <>
                        <p className={`text-3xl font-bold ${currentPostureScore.score >= 70 ? 'text-emerald-600' : currentPostureScore.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {currentPostureScore.score}
                          <span className="ml-1 text-base font-normal text-slate-400">/ 100</span>
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-400 dark:text-slate-500">
                          {new Date(currentPostureScore.analyzedAt).toLocaleDateString()}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">Not selected</p>
                    )}
                  </SectionCard>

                  {/* Threat counts */}
                  <SectionCard className="p-5">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Open Threats
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as ThreatSeverity[]).map((sev) => (
                        <span key={sev} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${THREAT_SEV_BADGE[sev]}`}>
                          {countBySev(sev)} {sev}
                        </span>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              )}

              {/* ── Synthesis area ───────────────────────────────────────── */}
              {intelState === 'synthesizing' && (
                <div className="space-y-4">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              )}

              {(synthesis || intelState === 'complete') && synthesis && (
                <>
                  {/* Executive Summary */}
                  <SectionCard>
                    <SectionHeader icon={<Sparkles size={14} />} title="Executive Summary" />
                    <div className="relative p-5">
                      <button
                        onClick={handleCopySummary}
                        title="Copy summary"
                        className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      >
                        {copied ? <ClipboardCheck size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
                      </button>
                      <p className="pr-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {synthesis.executiveSummary}
                      </p>
                    </div>
                  </SectionCard>

                  {/* Priority Actions */}
                  {synthesis.priorityActions.length > 0 && (
                    <SectionCard>
                      <SectionHeader icon={<ListChecks size={14} />} title="Priority Actions" />
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {synthesis.priorityActions.map((action: PriorityAction) => (
                          <div key={action.rank} className="flex items-start gap-3 px-5 py-3.5">
                            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white dark:bg-slate-200 dark:text-slate-900">
                              {action.rank}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEV_CLS[action.severity] ?? SEV_CLS.low}`}>
                                  {action.severity}
                                </span>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SRC_CLS[action.source] ?? SRC_CLS.threat}`}>
                                  {action.source}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{action.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{action.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  )}
                </>
              )}

              {/* ── Detail panels ────────────────────────────────────────── */}
              <div className="space-y-4">
                {/* Threat Model panel */}
                {currentThreatModel && (
                  <CollapsiblePanel
                    title="Threat Model Details"
                    icon={<Shield size={14} />}
                    badge={
                      <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        {activeThreats.length} open
                      </span>
                    }
                  >
                    <div className="p-5">
                      <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
                        {currentThreatModel.name} · Saved {new Date(currentThreatModel.savedAt).toLocaleDateString()}
                      </p>
                      <div className="space-y-2">
                        {activeThreats.slice(0, 7).map((t) => (
                          <div key={t.id} className="flex items-start gap-2">
                            <span className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${THREAT_SEV_BADGE[t.severity]}`}>
                              {t.severity}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm text-slate-700 dark:text-slate-300">{t.title}</p>
                              <p className="text-xs text-slate-400">{t.targetLabel} · {t.strideCategory}</p>
                            </div>
                          </div>
                        ))}
                        {activeThreats.length > 7 && (
                          <button
                            onClick={() => router.push(`/projects/${projectId}/threats`)}
                            className="text-xs text-indigo-500 hover:text-indigo-700"
                          >
                            View all {activeThreats.length} threats →
                          </button>
                        )}
                      </div>
                    </div>
                  </CollapsiblePanel>
                )}

                {/* Posture Score panel */}
                {currentPostureScore && (
                  <CollapsiblePanel
                    title="Posture Analysis"
                    icon={<BarChart2 size={14} />}
                    badge={
                      <span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-bold ${currentPostureScore.score >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : currentPostureScore.score >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                        {currentPostureScore.score}/100
                      </span>
                    }
                  >
                    <div className="p-5">
                      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {currentPostureScore.summary}
                      </p>
                      {currentPostureScore.topRecs.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Top Recommendations</p>
                          <ol className="space-y-1.5 list-decimal list-inside">
                            {currentPostureScore.topRecs.map((rec, i) => (
                              <li key={i} className="text-sm text-slate-600 dark:text-slate-300">{rec}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </CollapsiblePanel>
                )}

                {/* Attack Surface panel */}
                {currentAttackSim && (
                  <AttackSurfacePanel sim={currentAttackSim} />
                )}

                {/* Empty state */}
                {!currentThreatModel && !currentPostureScore && !currentAttackSim && intelState === 'ready' && (
                  <SectionCard className="p-10">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:ring-indigo-800">
                        <Shield size={24} className="text-indigo-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No security analyses yet</p>
                      <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
                        Run STRIDE threat analysis, posture score, and Attack Mind from the AI panel in the diagram editor.
                      </p>
                      <button
                        onClick={() => router.push(`/projects/${projectId}`)}
                        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Open Diagram Editor
                      </button>
                    </div>
                  </SectionCard>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
