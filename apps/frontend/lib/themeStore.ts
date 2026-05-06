export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'layers_theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
}

export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
}

/** Returns the resolved 'light' | 'dark' given the stored theme preference. */
export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}
