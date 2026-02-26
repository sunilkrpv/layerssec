/**
 * Typed API client for drafter-rest backend.
 * Base URL is read from NEXT_PUBLIC_API_URL (defaults to http://localhost:4000).
 */

const BASE_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:4000';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('drafter_access_token');
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

export function apiListProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/api/projects');
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
