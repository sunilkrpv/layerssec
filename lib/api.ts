/**
 * Typed API client for drafter-rest backend.
 * Base URL is read from NEXT_PUBLIC_API_URL (defaults to http://localhost:4000).
 */

const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:4000';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

function storeNewTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

function dispatchUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('drafter:unauthorized'));
  }
}

/** Thrown when the backend returns 401 and token refresh has failed or no refresh token exists. */
export class ApiUnauthorizedError extends Error {
  constructor() {
    super('Session expired — please sign in again');
    this.name = 'ApiUnauthorizedError';
  }
}

// Mutex: prevents multiple simultaneous refresh calls when concurrent requests all get 401.
let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

/**
 * Silently refreshes the access token using the stored refresh token.
 * Concurrent callers share a single in-flight refresh request.
 * Returns the new access token, or null if no refresh token is stored.
 * Throws if the refresh request itself fails (expired / invalid refresh token).
 */
async function attemptTokenRefresh(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Refresh failed');
        return res.json() as Promise<{ accessToken: string; refreshToken: string }>;
      })
      .finally(() => { refreshPromise = null; });
  }

  const tokens = await refreshPromise;
  storeNewTokens(tokens.accessToken, tokens.refreshToken);
  return tokens.accessToken;
}

/**
 * Like `fetch`, but injects the auth header and transparently retries once after
 * a silent token refresh on 401. All other error status codes are returned as-is
 * so callers can handle them (e.g. 409 DraftExists, 404 no-content).
 */
async function fetchWithRefresh(url: string, options: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status !== 401) return res;

  // 401 — attempt silent refresh then retry once
  try {
    const newToken = await attemptTokenRefresh();
    if (newToken) {
      const retryRes = await fetch(url, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
      });
      if (retryRes.status !== 401) return retryRes;
    }
  } catch {
    // Refresh request itself failed (invalid / expired refresh token) — fall through
  }

  dispatchUnauthorized();
  throw new ApiUnauthorizedError();
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchWithRefresh(`${BASE_URL}${path}`, options);

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function apiRegister(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export function apiGetMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/users/me');
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  tags: string[];
  _count?: { diagrams: number };
  createdAt: string;
  updatedAt: string;
}

export interface DiagramMeta {
  id: string;
  name: string;
  type: string;
  thumbnail: string | null;
  updatedAt: string;
}

export interface DiagramFull extends DiagramMeta {
  canvasData: unknown;
}

export interface ProjectWithDiagrams extends Project {
  diagrams: DiagramMeta[];
}

export function apiListProjects(): Promise<ProjectWithVersioning[]> {
  return apiFetch<ProjectWithVersioning[]>('/api/projects');
}

export function apiCreateProject(name: string, description?: string): Promise<Project> {
  return apiFetch<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function apiGetProject(id: string): Promise<ProjectWithDiagrams> {
  return apiFetch<ProjectWithDiagrams>(`/api/projects/${id}`);
}

export function apiUpdateProject(id: string, name: string): Promise<Project> {
  return apiFetch<Project>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function apiDeleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/api/projects/${id}`, { method: 'DELETE' });
}

export function apiCreateDiagram(
  projectId: string,
  name: string,
  canvasData: unknown,
): Promise<DiagramFull> {
  return apiFetch<DiagramFull>(`/api/projects/${projectId}/diagrams`, {
    method: 'POST',
    body: JSON.stringify({ name, type: 'GENERAL', canvasData }),
  });
}

export function apiUpdateDiagram(diagramId: string, canvasData: unknown): Promise<DiagramFull> {
  return apiFetch<DiagramFull>(`/api/diagrams/${diagramId}`, {
    method: 'PATCH',
    body: JSON.stringify({ canvasData }),
  });
}

export function apiGetDiagram(diagramId: string): Promise<DiagramFull> {
  return apiFetch<DiagramFull>(`/api/diagrams/${diagramId}`);
}

// ─── Versioning ───────────────────────────────────────────────────────────────

export interface DiagramVersion {
  id: string;
  name: string;
  status: 'draft' | 'published';
  versionNumber?: number;
  publishComment?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectWithVersioning extends Project {
  hasDraft: boolean;
  draftId: string | null;
  publishedCount: number;
}

/** Thrown when checkout returns HTTP 409 — a draft already exists. */
export class DraftExistsError extends Error {
  existingDraftId: string;
  constructor(existingDraftId: string) {
    super('DRAFT_EXISTS');
    this.name = 'DraftExistsError';
    this.existingDraftId = existingDraftId;
  }
}

export function apiListProjectVersions(projectId: string): Promise<DiagramVersion[]> {
  return apiFetch<DiagramVersion[]>(`/api/projects/${projectId}/versions`);
}

export function apiPublishDiagram(diagramId: string, comment?: string): Promise<DiagramFull> {
  return apiFetch<DiagramFull>(`/api/diagrams/${diagramId}/publish`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function apiCheckoutVersion(
  projectId: string,
  fromDiagramId: string,
): Promise<DiagramFull> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/projects/${projectId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ fromDiagramId }),
  });

  if (res.status === 409) {
    const body = await res.json().catch(() => ({})) as { existingDraftId?: string };
    throw new DraftExistsError(body.existingDraftId ?? '');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<DiagramFull>;
}

export async function apiGetProjectDraft(projectId: string): Promise<DiagramFull | null> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/projects/${projectId}/draft`, {});

  // 404 or 204 = no draft found
  if (res.status === 404 || res.status === 204) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  // NestJS may return empty body or JSON null when no draft exists
  const text = await res.text();
  if (!text || text.trim() === 'null') return null;
  return JSON.parse(text) as DiagramFull;
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export interface AiGenerateResponse {
  /** Parsed diagram in React Flow format: { nodes, edges } */
  data: { nodes: unknown[]; edges: unknown[] };
  usage: { tokensUsed: number; durationMs: number; model: string };
}

export function apiGenerateDiagram(
  prompt: string,
  diagramId?: string,
): Promise<AiGenerateResponse> {
  return apiFetch<AiGenerateResponse>('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, diagramId }),
  });
}

// ─── Chat History ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  layerId?: string | null;
  layerName?: string | null;
  diagramData?: { nodes: unknown[]; edges: unknown[] } | null;
  createdAt: string;
}

interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
  layerId?: string;
  layerName?: string;
}

export function apiGetChatHistory(projectId: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/api/projects/${projectId}/chat/messages`);
}

export function apiSaveChatMessages(
  projectId: string,
  messages: ChatMessageInput[],
): Promise<void> {
  return apiFetch<void>(`/api/projects/${projectId}/chat/messages`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

/** Chat-specific generate endpoint — uses Drafter system prompt and saves to chat history. */
export function apiChatGenerate(payload: {
  prompt: string;
  projectId?: string;
  diagramId?: string;
  layerId?: string;
  layerName?: string;
}): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  return apiFetch<{ nodes: unknown[]; edges: unknown[] }>('/api/ai/chat/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Streaming contextual chat — gathers live diagram info, nodes, versions + semantic memories
 *  from ChromaDB before generating a response. Used by the AI History page. */
export async function apiContextualChatAsk(
  payload: {
    message: string;
    projectId: string;
    diagramId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/ai/chat/contextual-ask`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

/** Streaming conversational chat with memory — streams text and saves to chat history server-side. */
export async function apiChatAsk(
  payload: {
    message: string;
    projectId?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    layerContext?: { layerId?: string; layerName?: string; nodes: unknown[]; edges: unknown[] };
  },
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/ai/chat/ask`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

// ─── Threat Models ────────────────────────────────────────────────────────────

export type StrideCategory =
  | 'SPOOFING'
  | 'TAMPERING'
  | 'REPUDIATION'
  | 'INFORMATION_DISCLOSURE'
  | 'DENIAL_OF_SERVICE'
  | 'ELEVATION_OF_PRIVILEGE';

export type ThreatSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type ThreatStatus =
  | 'IDENTIFIED'
  | 'IN_PROGRESS'
  | 'MITIGATED'
  | 'ACCEPTED'
  | 'FALSE_POSITIVE';

export type IdentifiedBy = 'AI' | 'USER';

export interface ThreatItem {
  targetId: string;
  targetType: string;
  targetLabel: string;
  layerId: string;
  strideCategory: StrideCategory;
  title: string;
  description: string;
  severity: ThreatSeverity;
}

export interface SavedThreat extends ThreatItem {
  id: string;
  threatModelId: string;
  status: ThreatStatus;
  mitigationNotes: string | null;
  identifiedBy: IdentifiedBy;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectThreat extends SavedThreat {
  threatModel: {
    id: string;
    name: string;
    diagramVersion: number;
    savedAt: string;
    diagramId: string;
  };
}

export interface ThreatModelSummary {
  id: string;
  name: string;
  diagramVersion: number;
  savedAt: string;
  threatCount: number;
  severitySummary: Record<string, number>;
  mitigatedCount: number;
}

export interface ThreatModelFull {
  id: string;
  name: string;
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  snapshotData: unknown;
  savedAt: string;
  threats: SavedThreat[];
}

/** Run STRIDE threat analysis on the current diagram layer — returns transient threats (not saved). */
export function apiRunThreatAnalysis(payload: {
  diagramId: string;
  layerId: string;
  layerName?: string;
  nodes: unknown[];
  edges: unknown[];
  trustBoundaries?: unknown[];
}): Promise<{ threats: ThreatItem[] }> {
  return apiFetch<{ threats: ThreatItem[] }>('/api/ai/threat-analysis', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Save a threat model snapshot explicitly to the backend. */
export function apiSaveThreatModel(
  projectId: string,
  payload: {
    name?: string;
    diagramId: string;
    diagramVersion: number;
    snapshotData: unknown;
    threats: ThreatItem[];
  },
): Promise<ThreatModelFull> {
  return apiFetch<ThreatModelFull>(`/api/projects/${projectId}/threat-models`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** List all saved threat models for a project (summary only). */
export function apiListThreatModels(projectId: string): Promise<ThreatModelSummary[]> {
  return apiFetch<ThreatModelSummary[]>(`/api/projects/${projectId}/threat-models`);
}

/** Get a single saved threat model with all threats. */
export function apiGetThreatModel(threatModelId: string): Promise<ThreatModelFull> {
  return apiFetch<ThreatModelFull>(`/api/threat-models/${threatModelId}`);
}

/** Delete a saved threat model. */
export function apiDeleteThreatModel(threatModelId: string): Promise<void> {
  return apiFetch<void>(`/api/threat-models/${threatModelId}`, { method: 'DELETE' });
}

/** Create a user-defined threat within an existing threat model. */
export function apiCreateThreat(
  threatModelId: string,
  payload: ThreatItem & { mitigationNotes?: string },
): Promise<SavedThreat> {
  return apiFetch<SavedThreat>(`/api/threat-models/${threatModelId}/threats`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Delete a single threat from a saved model. */
export function apiDeleteThreat(threatModelId: string, threatId: string): Promise<void> {
  return apiFetch<void>(`/api/threat-models/${threatModelId}/threats/${threatId}`, { method: 'DELETE' });
}

/** Update fields on a single threat. */
export function apiUpdateThreat(
  threatModelId: string,
  threatId: string,
  payload: Partial<{
    title: string;
    description: string;
    targetLabel: string;
    strideCategory: StrideCategory;
    severity: ThreatSeverity;
    status: ThreatStatus;
    mitigationNotes: string;
  }>,
): Promise<SavedThreat> {
  return apiFetch<SavedThreat>(`/api/threat-models/${threatModelId}/threats/${threatId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export interface ThreatsDashboardResult {
  data: ProjectThreat[];
  total: number;
  page: number;
  limit: number;
  summary: { totalActive: number; mitigated: number; critical: number; high: number };
}

/** List threats for the dashboard — paginated and filtered by the backend. */
export function apiListProjectThreats(
  projectId: string,
  params?: {
    page?: number;
    limit?: number;
    search?: string;
    severity?: ThreatSeverity;
    status?: ThreatStatus;
    strideCategory?: StrideCategory;
  },
): Promise<ThreatsDashboardResult> {
  const qs = new URLSearchParams();
  if (params?.page !== undefined) qs.set('page', String(params.page));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.status) qs.set('status', params.status);
  if (params?.strideCategory) qs.set('strideCategory', params.strideCategory);
  const query = qs.toString();
  return apiFetch<ThreatsDashboardResult>(`/api/projects/${projectId}/threats${query ? `?${query}` : ''}`);
}

/** Download threat model PDF report — triggers browser file download. */
export async function apiExportThreatReport(projectId: string): Promise<void> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/projects/${projectId}/threats/report`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `threat-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Posture Score ─────────────────────────────────────────────────────────

export interface PostureScoreDimension {
  name: string;
  score: number;
  maxScore: number;
}

export interface PostureDeduction {
  reason: string;
  points: number;
  severity?: string;
  dimension?: string;
}

export interface PostureAddition {
  reason: string;
  points: number;
  dimension?: string;
}

/** Per-layer breakdown stored inside PostureScoreResult.layerScores */
export interface LayerPostureScore {
  layerId: string;
  layerName: string;
  score: number;
  dimensions: PostureScoreDimension[];
  deductions: PostureDeduction[];
  additions: PostureAddition[];
}

export interface PostureScoreResult {
  id: string;
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  /** Weighted aggregate score across all layers */
  score: number;
  dimensions: PostureScoreDimension[];
  deductions: PostureDeduction[];
  additions: PostureAddition[];
  summary: string;
  topRecs: string[];
  /** Per-layer breakdown — null for records created before this feature */
  layerScores: Record<string, LayerPostureScore> | null;
  useExtended: boolean;
  analyzedAt: string;
}

export interface PostureScoreHistoryItem {
  id: string;
  diagramVersion: number;
  score: number;
  dimensions: PostureScoreDimension[];
  summary: string;
  topRecs: string[];
  layerScores: Record<string, LayerPostureScore> | null;
  useExtended: boolean;
  analyzedAt: string;
}

/** Compute + persist a security posture score for a cloud project diagram. */
export function apiComputePostureScore(payload: {
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  layers: Record<string, unknown>;
  useExtendedThinking?: boolean;
}): Promise<PostureScoreResult> {
  return apiFetch<PostureScoreResult>('/api/ai/posture-score', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** List historical posture score snapshots for a project. */
export function apiGetPostureScoreHistory(projectId: string): Promise<PostureScoreHistoryItem[]> {
  return apiFetch<PostureScoreHistoryItem[]>(`/api/projects/${projectId}/posture-score/history`);
}

// ── Attack Mind ───────────────────────────────────────────────────────────

export interface AttackStep {
  stepNumber: number;
  nodeIds: string[];
  edgeIds: string[];
  action: string;
  attackTechnique: string;
  description: string;
  successLikelihood: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AttackPath {
  pathId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  likelihood: 'HIGH' | 'MEDIUM' | 'LOW';
  entryPointNodeId: string;
  entryPointLabel: string;
  steps: AttackStep[];
  crownJewelNodeIds: string[];
  summary: string;
  mitigations: string[];
}

export interface AttackMindResult {
  entryPointAnalysis: string;
  paths: AttackPath[];
}

export interface AttackSimulation {
  id: string;
  name: string;
  diagramId: string;
  entryPointId: string | null;
  paths: AttackPath[];
  savedBy: string;
  createdAt: string;
}

/** Stream a red-team attack simulation — calls onChunk with accumulated JSON text. */
export async function apiRunAttackMind(
  payload: {
    projectId: string;
    diagramId: string;
    layers: Record<string, unknown>;
    entryPointNodeId?: string;
    useExtendedThinking?: boolean;
  },
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/ai/attack-mind`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

/** Persist an attack simulation result as a named snapshot. */
export function apiSaveAttackSimulation(payload: {
  projectId: string;
  diagramId: string;
  name: string;
  entryPointId?: string;
  paths: AttackPath[];
}): Promise<AttackSimulation> {
  return apiFetch<AttackSimulation>(`/api/projects/${payload.projectId}/attack-simulations`, {
    method: 'POST',
    body: JSON.stringify({
      diagramId: payload.diagramId,
      name: payload.name,
      entryPointId: payload.entryPointId,
      paths: payload.paths,
    }),
  });
}

/** List saved attack simulations for a project. */
export function apiListAttackSimulations(projectId: string): Promise<AttackSimulation[]> {
  return apiFetch<AttackSimulation[]>(`/api/projects/${projectId}/attack-simulations`);
}

/** Delete a saved attack simulation. */
export function apiDeleteAttackSimulation(simulationId: string): Promise<void> {
  return apiFetch<void>(`/api/attack-simulations/${simulationId}`, { method: 'DELETE' });
}

/** Streaming evaluate — streams text chunks and saves both messages to chat history server-side. */
export async function apiChatEvaluate(
  payload: {
    nodes: unknown[];
    edges: unknown[];
    layerName?: string;
    userQuestion?: string;
    projectId?: string;
    layerId?: string;
  },
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/ai/chat/evaluate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
