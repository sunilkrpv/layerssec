'use client';

import { useEffect, useState } from 'react';

export type Density = 'comfortable' | 'cozy' | 'compact';

const STORAGE_KEY = 'layers_density';

export const densityClasses: Record<Density, { row: string; text: string }> = {
  comfortable: { row: 'py-3', text: 'text-sm' },
  cozy: { row: 'py-2', text: 'text-sm' },
  compact: { row: 'py-1', text: 'text-xs' },
};

function readFromStorage(): Density {
  if (typeof window === 'undefined') return 'cozy';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'comfortable' || raw === 'cozy' || raw === 'compact') return raw;
  return 'cozy';
}

export function useDensity() {
  const [density, setDensityState] = useState<Density>('cozy');

  useEffect(() => {
    setDensityState(readFromStorage());
  }, []);

  const setDensity = (next: Density) => {
    setDensityState(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
  };

  return { density, setDensity };
}
