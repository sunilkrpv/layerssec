// lib/pipelineState.ts
// Persists pipeline phase per project in localStorage.
// Key: `layers_pipeline_${projectId}`

export type PipelinePhase =
  | 'idle'            // No pipeline started
  | 'nudge'           // Diagram generated/saved — show "Run threat analysis?" prompt
  | 'threat_running'  // Threat analysis job submitted and running
  | 'threat_done'     // Threat analysis complete — show "Run posture score?" prompt
  | 'posture_running' // Posture score job submitted and running
  | 'complete';       // Both done — show Pipeline Complete card

export interface PipelineState {
  phase: PipelinePhase;
  threatJobId?: string;
  threatModelId?: string;     // resultRef from completed threat job
  postureJobId?: string;
  postureScoreId?: string;    // resultRef from completed posture job
  completedAt?: string;
  nudgeDismissed?: boolean;
}

const key = (projectId: string) => `layers_pipeline_${projectId}`;

export function loadPipelineState(projectId: string): PipelineState {
  if (typeof window === 'undefined') return { phase: 'idle' };
  try {
    const raw = localStorage.getItem(key(projectId));
    if (!raw) return { phase: 'idle' };
    return JSON.parse(raw) as PipelineState;
  } catch {
    return { phase: 'idle' };
  }
}

export function savePipelineState(projectId: string, state: PipelineState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(projectId), JSON.stringify(state));
  } catch {
    // Quota exceeded — silently ignore
  }
}

export function clearPipelineState(projectId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key(projectId));
}

/** Call after diagram generation or manual save to advance to nudge phase.
 *  Skips if already in a running/complete phase (don't interrupt active pipeline). */
export function advanceToNudge(projectId: string): PipelineState {
  const current = loadPipelineState(projectId);
  if (
    current.phase === 'threat_running' ||
    current.phase === 'posture_running' ||
    current.phase === 'complete'
  ) {
    return current; // Don't interrupt
  }
  const next: PipelineState = { phase: 'nudge', nudgeDismissed: false };
  savePipelineState(projectId, next);
  return next;
}
