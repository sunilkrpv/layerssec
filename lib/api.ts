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

/** Thrown when the backend returns 401. DiagramPage listens for `drafter:unauthorized` event. */
export class ApiUnauthorizedError extends Error {
  constructor() {
    super('Session expired — please sign in again');
    this.name = 'ApiUnauthorizedError';
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drafter:unauthorized'));
    }
    throw new ApiUnauthorizedError();
  }

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
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/projects/${projectId}/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fromDiagramId }),
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drafter:unauthorized'));
    }
    throw new ApiUnauthorizedError();
  }

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
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/projects/${projectId}/draft`, { headers });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drafter:unauthorized'));
    }
    throw new ApiUnauthorizedError();
  }
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
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/ai/chat/contextual-ask`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drafter:unauthorized'));
    }
    throw new ApiUnauthorizedError();
  }
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
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/ai/chat/ask`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drafter:unauthorized'));
    }
    throw new ApiUnauthorizedError();
  }
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
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/ai/chat/evaluate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('drafter:unauthorized'));
    }
    throw new ApiUnauthorizedError();
  }
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
