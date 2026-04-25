/**
 * Thin localStorage wrapper for auth tokens and user profile.
 * All functions are safe to call on the server (they no-op when window is undefined).
 */

import { apiLogout, type UserProfile } from './api';

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';
const USER_KEY = 'user';

export function saveTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function signOut(): void {
  if (typeof window === 'undefined') return;
  const rt = localStorage.getItem(REFRESH_KEY);
  clearTokens();
  if (rt) {
    void apiLogout(rt).catch(() => undefined);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function saveUser(user: UserProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

// A user is considered logged in if they have a refresh token (even if the access token
// has expired — it will be refreshed transparently on the first API call).
export function isLoggedIn(): boolean {
  return !!(getAccessToken() || getRefreshToken());
}

