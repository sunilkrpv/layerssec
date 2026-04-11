/**
 * Typed API client for layers-rest backend.
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
    window.dispatchEvent(new CustomEvent('layers:unauthorized'));
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
  provider?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
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

/** Chat-specific generate endpoint — uses Layers system prompt and saves to chat history. */
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

/** Declutter the current diagram layer — returns new x/y positions for every node. */
export function apiDeclutter(payload: {
  nodes: unknown[];
  edges: unknown[];
  layerName?: string;
}): Promise<{ positions: Record<string, { x: number; y: number }> }> {
  return apiFetch<{ positions: Record<string, { x: number; y: number }> }>('/api/ai/declutter', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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
  deductions: PostureDeduction[];
  additions: PostureAddition[];
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
  entryPointNodeId: string | null;
  /** Long-form markdown content returned by the new schema (post-PRD9 refactor) */
  content?: string;
  /** Legacy field — present on records saved before PRD9 schema refactor */
  paths?: AttackPath[];
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

// ─── Security Command Center ───────────────────────────────────────────────

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  latestPostureScore: number | null;
  openThreatCount: number;
  criticalThreatCount: number;
  lastActivityAt: string;
}

export interface ProjectOverview {
  project: { id: string; name: string; status: string };
  postureScore: {
    score: number | null;
    label: 'Good' | 'Fair' | 'Poor' | null;
    weekDelta: number | null;
    layerCount: number;
    layerScores: Record<string, { layerName: string; score: number }>;
    computedAt: string | null;
  };
  threats: {
    total: number;
    bySeverity: { critical: number; high: number; medium: number; low: number; info: number };
    byStride: { S: number; T: number; R: number; I: number; D: number; E: number };
  };
  attackSims: {
    total: number;
    lastRunAt: string | null;
    topPathSummary: string | null;
  };
  layers: Array<{
    layerId: string;
    layerName: string;
    postureScore: number | null;
    threatCount: number;
    nodeCount: number;
  }>;
  recentActivity: Array<{
    type: 'ai_generation' | 'stride_analysis' | 'posture_score' | 'attack_simulation';
    description: string;
    occurredAt: string;
  }>;
}

/** All projects with latest security metadata — powers the sidebar. */
export function apiGetProjectsSummary(): Promise<ProjectSummary[]> {
  return apiFetch<ProjectSummary[]>('/api/projects/summary');
}

/** Per-project security intelligence for the Command Center. */
export function apiGetProjectOverview(projectId: string): Promise<ProjectOverview> {
  return apiFetch<ProjectOverview>(`/api/projects/${projectId}/overview`);
}

// ─── AI Settings ──────────────────────────────────────────────────────────────

export type AiProvider = 'ANTHROPIC' | 'OPENAI' | 'OLLAMA' | 'REPLICATE';

export interface UserAiSettings {
  provider: AiProvider;
  model: string;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  ollamaBaseUrl: string | null;
  openAiBaseUrl: string | null;
  /** True when an Anthropic API key is stored (key is never returned in plaintext). */
  anthropicKeySet: boolean;
  /** Masked preview, e.g. "sk-ant-api03-••••••••" */
  anthropicKeyMasked: string | null;
  openAiKeySet: boolean;
  openAiKeyMasked: string | null;
}

/** Write-only payload for updating settings — API keys transmitted over HTTPS, encrypted at rest. */
export interface UpdateAiSettingsPayload {
  provider?: AiProvider;
  model?: string;
  maxOutputTokens?: number | null;
  ollamaBaseUrl?: string | null;
  openAiBaseUrl?: string | null;
  /** Provide key to set/replace. Send "" to clear. Omit to leave unchanged. */
  anthropicApiKey?: string;
  /** Provide key to set/replace. Send "" to clear. Omit to leave unchanged. */
  openAiApiKey?: string;
}

export interface AiTokenMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  byModel: Array<{
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    calls: number;
  }>;
}

export function apiGetAiSettings(): Promise<UserAiSettings> {
  return apiFetch<UserAiSettings>('/api/user/ai-settings');
}

export function apiUpdateAiSettings(payload: UpdateAiSettingsPayload): Promise<UserAiSettings> {
  return apiFetch<UserAiSettings>('/api/user/ai-settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function apiGetAiMetrics(): Promise<AiTokenMetrics> {
  return apiFetch<AiTokenMetrics>('/api/user/ai-metrics');
}

// ── Async AI job endpoints ────────────────────────────────────────────────────

export type AiJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type AiJobType = 'THREAT_ANALYSIS' | 'POSTURE_SCORE' | 'ATTACK_SIMULATION' | 'DECLUTTER';

export interface AiJobStatusResponse {
  id: string;
  type: AiJobType;
  status: AiJobStatus;
  progress: number;
  resultRef: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/** Submit a threat analysis as a background job — returns { jobId } immediately. */
export function apiSubmitThreatAnalysis(payload: {
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  layerId: string;
  layerName?: string;
  modelName?: string;
  nodes: unknown[];
  edges: unknown[];
  trustBoundaries?: unknown[];
}): Promise<{ jobId: string }> {
  return apiFetch<{ jobId: string }>('/api/ai/threat-analysis/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Pipeline Status ───────────────────────────────────────────────────────────

export interface PipelineJobStatus {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  resultRef: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PipelineStatusResponse {
  threatJob: PipelineJobStatus | null;
  postureJob: PipelineJobStatus | null;
}

export function apiGetPipelineStatus(projectId: string): Promise<PipelineStatusResponse> {
  return apiFetch<PipelineStatusResponse>(`/api/ai/projects/${projectId}/pipeline-status`);
}

/** Submit a posture score as a background job — returns { jobId } immediately. */
export function apiSubmitPostureScore(payload: {
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  layers: unknown;
  useExtendedThinking?: boolean;
  threatModelId?: string;
}): Promise<{ jobId: string }> {
  return apiFetch<{ jobId: string }>('/api/ai/posture-score/submit', {
    method: 'POST',
    body: JSON.stringify({
      projectId: payload.projectId,
      diagramId: payload.diagramId,
      diagramVersion: payload.diagramVersion,
      layers: payload.layers,
      useExtendedThinking: payload.useExtendedThinking,
      threatModelId: payload.threatModelId,
    }),
  });
}

/** Poll the status of an async AI job. */
export function apiGetJobStatus(jobId: string): Promise<AiJobStatusResponse> {
  return apiFetch<AiJobStatusResponse>(`/api/jobs/${jobId}/status`);
}

/** Cancel a running or pending async AI job. */
export function apiCancelJob(jobId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
}

/** List recent async AI jobs for the current user. */
export function apiListJobs(projectId?: string): Promise<AiJobStatusResponse[]> {
  const qs = projectId ? `?projectId=${projectId}` : '';
  return apiFetch<AiJobStatusResponse[]>(`/api/jobs${qs}`);
}

// ── AI Activity (observability) ────────────────────────────────────────────────

export interface AiJobListItem {
  id: string;
  type: AiJobType;
  status: AiJobStatus;
  progress: number;
  resultRef: string | null;
  errorMessage: string | null;
  projectId: string | null;
  projectName: string | null;
  diagramId: string | null;
  layerId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AiActivityFilters {
  types?: AiJobType[];
  statuses?: AiJobStatus[];
  dateRange?: '1h' | '1d' | '7d' | '30d';
  search?: string;
  limit?: number;
  offset?: number;
}

export function apiListActivity(
  filters: AiActivityFilters = {},
): Promise<{ jobs: AiJobListItem[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.types?.length) params.set('types', filters.types.join(','));
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.dateRange) params.set('dateRange', filters.dateRange);
  if (filters.search) params.set('search', filters.search);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return apiFetch<{ jobs: AiJobListItem[]; total: number }>(
    `/api/jobs/activity${qs ? `?${qs}` : ''}`,
  );
}

// ─── Threat Agent Chat ────────────────────────────────────────────────────────

export interface ThreatChatPayload {
  projectId: string;
  diagramId: string;
  layerId: string;
  layerName?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  nodes: Array<{
    id: string; type?: string; label?: string;
    technology?: string; description?: string; trustLevel?: string;
  }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
  trustBoundaries?: Array<{ id: string; label?: string; trustLevel?: string }>;
}

export interface KeyFinding {
  category: string;
  count: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export type ThreatChatEvent =
  | { type: 'message'; delta: string }
  | { type: 'message_done' }
  | { type: 'analysis_triggered'; jobId: string }
  | { type: 'analysis_complete'; modelId: string; threatCount: number; summary: string; keyFindings: KeyFinding[] }
  | { type: 'error'; message: string };

/**
 * Multi-turn threat agent chat — streams typed SSE events.
 * Backend handles phase detection, job submission, and ChromaDB indexing.
 *
 * Usage:
 *   for await (const event of apiThreatAgentChat(payload)) { ... }
 */
export async function* apiThreatAgentChat(
  payload: ThreatChatPayload,
): AsyncGenerator<ThreatChatEvent> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/ai/threat-analysis/chat`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    yield { type: 'error', message: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: 'error', message: 'No response stream' };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are delimited by \n\n
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? ''; // last item may be incomplete

    for (const frame of frames) {
      if (!frame.trim()) continue;

      let eventName = 'message';
      let dataLine = '';

      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataLine = line.slice(6).trim();
      }

      if (!dataLine) continue;

      try {
        const parsed = JSON.parse(dataLine) as Record<string, unknown>;
        switch (eventName) {
          case 'message':
            yield { type: 'message', delta: parsed.delta as string };
            break;
          case 'message_done':
            yield { type: 'message_done' };
            break;
          case 'analysis_triggered':
            yield { type: 'analysis_triggered', jobId: parsed.jobId as string };
            break;
          case 'analysis_complete':
            yield {
              type: 'analysis_complete',
              modelId: parsed.modelId as string,
              threatCount: parsed.threatCount as number,
              summary: parsed.summary as string,
              keyFindings: (parsed.keyFindings ?? []) as KeyFinding[],
            };
            break;
          case 'error':
            yield { type: 'error', message: parsed.message as string };
            break;
        }
      } catch {
        // Malformed SSE frame — skip
      }
    }
  }
}

// ── Security Posture Score Stream ──────────────────────────────────────────

export interface PostureScoreJobResult {
  postureScoreId: string;
  score: number;
  summary: string;
  topRecs: string[];
  layerCount: number;
  /** Raw LLM architectural score before threat penalty; equals score when no threat model linked */
  rawLlmScore?: number;
  /** Points deducted for unmitigated threats (CRITICAL×4 + HIGH×2 + MEDIUM×0.5) */
  threatPenalty?: number;
}

export type PostureScoreStreamEvent =
  | { event: 'job_submitted'; jobId: string }
  | { event: 'job_complete'; data: PostureScoreJobResult }
  | { event: 'error'; message: string };

export async function* apiPostureScoreStream(payload: {
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  layers: unknown;
  useExtendedThinking?: boolean;
}): AsyncGenerator<PostureScoreStreamEvent> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/ai/posture-score/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const frame of frames) {
      if (!frame.trim()) continue;
      const lines = frame.split('\n');
      let eventName = '';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
      }
      if (!eventName) continue;
      try {
        const parsed = dataStr ? (JSON.parse(dataStr) as Record<string, unknown>) : {};
        if (eventName === 'job_submitted') yield { event: 'job_submitted', jobId: parsed.jobId as string };
        else if (eventName === 'job_complete') yield { event: 'job_complete', data: parsed as unknown as PostureScoreJobResult };
        else if (eventName === 'error') yield { event: 'error', message: (parsed.message as string) ?? 'Unknown error' };
      } catch { /* malformed frame */ }
    }
  }
}

// ── Attack Mind Stream ─────────────────────────────────────────────────────

export interface AttackMindJobResult {
  simulationId: string;
  entryPointLabel: string;
  summary: string;
  contentLength: number;
}

export type AttackMindStreamEvent =
  | { event: 'job_submitted'; jobId: string }
  | { event: 'job_complete'; data: AttackMindJobResult }
  | { event: 'error'; message: string };

export async function* apiAttackMindStream(payload: {
  projectId: string;
  diagramId: string;
  diagramVersion: number;
  layers: unknown;
  entryPointNodeId?: string;
  useExtendedThinking?: boolean;
}): AsyncGenerator<AttackMindStreamEvent> {
  const res = await fetchWithRefresh(`${BASE_URL}/api/ai/attack-mind/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const frame of frames) {
      if (!frame.trim()) continue;
      const lines = frame.split('\n');
      let eventName = '';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventName = line.slice(7).trim();
        else if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
      }
      if (!eventName) continue;
      try {
        const parsed = dataStr ? (JSON.parse(dataStr) as Record<string, unknown>) : {};
        if (eventName === 'job_submitted') yield { event: 'job_submitted', jobId: parsed.jobId as string };
        else if (eventName === 'job_complete') yield { event: 'job_complete', data: parsed as unknown as AttackMindJobResult };
        else if (eventName === 'error') yield { event: 'error', message: (parsed.message as string) ?? 'Unknown error' };
      } catch { /* malformed frame */ }
    }
  }
}

// ── Security Intel ────────────────────────────────────────────────────────────

export interface PriorityAction {
  rank: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: 'threat' | 'posture' | 'attack';
  title: string;
  detail: string;
}

export interface IntelSynthesisResult {
  executiveSummary: string;
  priorityActions: PriorityAction[];
}

export function apiIntelSynthesis(payload: {
  projectId: string;
  threatModelId: string;
  postureScoreId: string;
  attackSimulationId?: string;
}): Promise<IntelSynthesisResult> {
  return apiFetch<IntelSynthesisResult>('/api/ai/intel-synthesis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function apiExportIntelReport(params: {
  projectId: string;
  threatModelId: string;
  postureScoreId: string;
  attackSimulationId?: string;
  executiveSummary?: string;
  priorityActions?: PriorityAction[];
}): Promise<void> {
  const { projectId, ...body } = params;
  const res = await fetchWithRefresh(`${BASE_URL}/api/projects/${projectId}/intel-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() ?? ''}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'security-intel-report.pdf';
  a.click();
  URL.revokeObjectURL(url);
}
