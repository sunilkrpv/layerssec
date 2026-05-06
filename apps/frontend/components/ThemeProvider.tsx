'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ThemeContext } from '@/lib/themeContext';
import { getStoredTheme, saveTheme, getEffectiveTheme, type Theme } from '@/lib/themeStore';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');

  // Hydrate from localStorage on first mount
  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  // Apply or remove the `dark` class on <html> whenever resolved theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (getEffectiveTheme(theme) === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Track system-preference changes when theme === 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = document.documentElement;
      if (mq.matches) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    saveTheme(newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
