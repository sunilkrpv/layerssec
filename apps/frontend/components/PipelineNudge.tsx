'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Shield, Loader2, ChevronRight, CheckCircle2, X,
  Sparkles, ArrowRight,
} from 'lucide-react';
import {
  PipelinePhase, PipelineState,
  loadPipelineState, savePipelineState,
} from '@/lib/pipelineState';
import {
  apiGetPipelineStatus, apiSubmitPostureScore, apiSubmitThreatAnalysis,
  type PipelineJobStatus,
} from '@/lib/api';

interface PipelineNudgeProps {
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  diagramLayers: unknown;
  /** Nodes for threat analysis */
  threatNodes: Array<{ id: string; type?: string; label?: string; [k: string]: unknown }>;
  /** Edges for threat analysis */
  threatEdges: Array<{ id: string; source: string; target: string; label?: string }>;
  layerId: string;
  layerName?: string;
  onShowSecurityIntel?: () => void;
  onPhaseChange?: (phase: PipelinePhase) => void;
  isDark?: boolean;
}

const POLL_INTERVAL_MS = 5000;

export function PipelineNudge({
  projectId, diagramId, diagramVersion, diagramLayers,
  threatNodes, threatEdges, layerId, layerName,
  onShowSecurityIntel, onPhaseChange, isDark,
}: PipelineNudgeProps) {
  const [state, setState] = useState<PipelineState>(() => loadPipelineState(projectId));
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const persist = useCallback((next: PipelineState) => {
    setState(next);
    savePipelineState(projectId, next);
    onPhaseChange?.(next.phase);
  }, [projectId, onPhaseChange]);

  // ── Polling ────────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const applyPollResult = useCallback((
    threatJob: PipelineJobStatus | null,
    postureJob: PipelineJobStatus | null,
    current: PipelineState,
  ) => {
    if (current.phase === 'threat_running' && threatJob) {
      if (threatJob.status === 'COMPLETED' && threatJob.resultRef) {
        stopPolling();
        persist({ ...current, phase: 'threat_done', threatModelId: threatJob.resultRef });
        return;
      }
      if (threatJob.status === 'FAILED') {
        stopPolling();
        persist({ phase: 'nudge' });
        return;
      }
    }
    if (current.phase === 'posture_running' && postureJob) {
      if (postureJob.status === 'COMPLETED' && postureJob.resultRef) {
        stopPolling();
        persist({
          ...current,
          phase: 'complete',
          postureScoreId: postureJob.resultRef,
          completedAt: new Date().toISOString(),
        });
        return;
      }
      if (postureJob.status === 'FAILED') {
        stopPolling();
        persist({ ...current, phase: 'threat_done' });
        return;
      }
    }
  }, [persist, stopPolling]);

  const startPolling = useCallback((current: PipelineState) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { threatJob, postureJob } = await apiGetPipelineStatus(projectId);
        applyPollResult(threatJob, postureJob, current);
      } catch {
        // Network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [projectId, stopPolling, applyPollResult]);

  // Start polling on mount if already in a running phase
  useEffect(() => {
    const loaded = loadPipelineState(projectId);
    if (loaded.phase === 'threat_running' || loaded.phase === 'posture_running') {
      setState(loaded);
      startPolling(loaded);
    }
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // On mount, fast-forward state if jobs already completed server-side
  useEffect(() => {
    if (!projectId) return;
    apiGetPipelineStatus(projectId).then(({ threatJob, postureJob }) => {
      const current = loadPipelineState(projectId);
      if (current.phase === 'nudge' && threatJob?.status === 'COMPLETED' && threatJob.resultRef) {
        // Threat model already exists — skip to threat_done
        persist({ phase: 'threat_done', threatJobId: threatJob.id, threatModelId: threatJob.resultRef });
      } else if (
        current.phase !== 'complete' &&
        threatJob?.status === 'COMPLETED' && threatJob.resultRef &&
        postureJob?.status === 'COMPLETED' && postureJob.resultRef
      ) {
        persist({
          phase: 'complete',
          threatModelId: threatJob.resultRef,
          postureScoreId: postureJob.resultRef,
          completedAt: postureJob.completedAt ?? undefined,
        });
      }
    }).catch(() => { /* ignore */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleRunThreatAnalysis = useCallback(async () => {
    try {
      const { jobId } = await apiSubmitThreatAnalysis({
        projectId,
        diagramId,
        diagramVersion,
        layerId,
        layerName,
        nodes: threatNodes,
        edges: threatEdges,
      });
      const next: PipelineState = { phase: 'threat_running', threatJobId: jobId };
      persist(next);
      startPolling(next);
    } catch (e) {
      console.error('[PipelineNudge] threat analysis submit failed', e);
    }
  }, [projectId, diagramId, diagramVersion, layerId, layerName, threatNodes, threatEdges, persist, startPolling]);

  const handleRunPostureScore = useCallback(async () => {
    try {
      const { jobId } = await apiSubmitPostureScore({
        projectId,
        diagramId,
        diagramVersion,
        layers: diagramLayers,
        threatModelId: state.threatModelId,
      });
      const next: PipelineState = { ...state, phase: 'posture_running', postureJobId: jobId };
      persist(next);
      startPolling(next);
    } catch (e) {
      console.error('[PipelineNudge] posture score submit failed', e);
    }
  }, [projectId, diagramId, diagramVersion, diagramLayers, state, persist, startPolling]);

  const handleDismiss = useCallback(() => {
    persist({ phase: 'idle', nudgeDismissed: true });
    stopPolling();
  }, [persist, stopPolling]);

  // ── Styles ───────────────────────────────────────────────────────────────────

  const base = isDark
    ? 'rounded-xl border border-slate-700 bg-slate-800/80 p-3.5 text-sm'
    : 'rounded-xl border border-slate-200 bg-white p-3.5 text-sm shadow-sm';

  // ── Render ───────────────────────────────────────────────────────────────────

  if (state.phase === 'idle' || state.nudgeDismissed) return null;

  if (state.phase === 'nudge') {
    return (
      <div className={base}>
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40">
            <Shield size={14} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Run security analysis?</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Diagram is ready — identify STRIDE threats and score your security posture.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={handleRunThreatAnalysis}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Sparkles size={11} />
                Run Threat Analysis
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'threat_running') {
    return (
      <div className={base}>
        <div className="flex items-center gap-2.5">
          <Loader2 size={16} className="shrink-0 animate-spin text-blue-500" />
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Threat analysis running…</p>
            <p className="mt-0.5 text-xs text-slate-400">Running in background — keep working on your diagram.</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'threat_done') {
    return (
      <div className={base}>
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Threat analysis complete</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Now score your security posture using these findings.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={handleRunPostureScore}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
              >
                <ChevronRight size={11} />
                Run Posture Score
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'posture_running') {
    return (
      <div className={base}>
        <div className="flex items-center gap-2.5">
          <Loader2 size={16} className="shrink-0 animate-spin text-violet-500" />
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Scoring security posture…</p>
            <p className="mt-0.5 text-xs text-slate-400">Incorporating threat findings — this takes ~20s.</p>
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'complete') {
    return (
      <div className={`${base} border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20`}>
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-200 dark:bg-emerald-800">
            <Shield size={14} className="text-emerald-700 dark:text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">Security pipeline complete</p>
            <p className="mt-0.5 text-xs text-emerald-700/70 dark:text-emerald-400">
              Threat analysis and posture score are ready.
            </p>
            {onShowSecurityIntel && (
              <button
                onClick={onShowSecurityIntel}
                className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                View Security Intel
                <ArrowRight size={11} />
              </button>
            )}
          </div>
          <button onClick={handleDismiss} className="shrink-0 text-emerald-400 hover:text-emerald-600">
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
