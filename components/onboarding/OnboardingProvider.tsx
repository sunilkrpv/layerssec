'use client';

import type { ReactNode } from 'react';
import { OnboardingContext, useOnboardingStateInternal } from '@/lib/onboardingStore';

export default function OnboardingProvider({ children }: { children: ReactNode }) {
  const value = useOnboardingStateInternal();
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
