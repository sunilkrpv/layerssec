'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import {
  apiGetOnboarding,
  apiUpdateOnboarding,
  type OnboardingState,
  type UpdateOnboardingPayload,
} from '@/lib/api';

export interface OnboardingContextValue {
  state: OnboardingState | null;
  loading: boolean;
  /** Optimistically patch client-settable fields + persist to server. */
  update: (patch: UpdateOnboardingPayload) => Promise<void>;
  /** Force re-fetch from server — call after AI Settings save to flip aiConfigured. */
  refresh: () => Promise<void>;
}

export const OnboardingContext = createContext<OnboardingContextValue>({
  state: null,
  loading: true,
  update: async () => {},
  refresh: async () => {},
});

export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}

/**
 * Internal hook used by the provider — do not call directly from components.
 * Exposed here so the provider component can stay in a .tsx file.
 */
export function useOnboardingStateInternal(): OnboardingContextValue {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGetOnboarding();
      setState(data);
    } catch {
      // Unauthenticated or server error — leave state null so UI degrades to no-op
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (patch: UpdateOnboardingPayload) => {
    // Optimistic — merge patch into current state immediately
    setState((prev) => (prev ? { ...prev, ...patch } : prev));
    try {
      const next = await apiUpdateOnboarding(patch);
      setState(next);
    } catch {
      // Re-sync from server on failure
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, loading, update, refresh };
}
