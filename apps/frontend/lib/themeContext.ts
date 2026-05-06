import { createContext, useContext } from 'react';
import type { Theme } from './themeStore';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
