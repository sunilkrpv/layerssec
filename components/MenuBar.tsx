'use client';

import { useRouter } from 'next/navigation';
import { LogIn, LogOut, User, Sun, Moon, Monitor, Home } from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { useTheme } from '@/lib/themeContext';
import type { Theme } from '@/lib/themeStore';

interface MenuBarProps {
  /** Logged-in user email; null/undefined = not logged in */
  userEmail?: string | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  /** Whether a cloud project is currently open */
  isCloudProject?: boolean;
}

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun size={14} />,
  dark: <Moon size={14} />,
  system: <Monitor size={14} />,
};
const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export default function MenuBar({
  userEmail,
  onSignIn,
  onSignOut,
  isCloudProject,
}: MenuBarProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  return (
    <div className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mr-3 flex items-center gap-1.5 pl-1">
        <LayersLogo size={14} className="text-blue-600" />
        <span className="hidden text-sm font-bold text-slate-800 md:inline dark:text-slate-100">Layers</span>
      </div>

      {isCloudProject && (
        <>
          <div className="mr-2 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            onClick={() => router.push('/home')}
            title="Home"
            aria-label="Home"
            className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <Home size={14} />
          </button>
        </>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={cycleTheme}
          title={`Theme: ${THEME_LABELS[theme]} — click to cycle`}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          {THEME_ICONS[theme]}
          <span className="hidden sm:inline">{THEME_LABELS[theme]}</span>
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

        {userEmail ? (
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
            title={`Signed in as ${userEmail}`}
          >
            <User size={13} className="text-slate-500 dark:text-slate-400" />
            <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</span>
            <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
          </button>
        ) : (
          <button
            onClick={onSignIn}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <LogIn size={13} className="text-blue-600" />
            <span>Sign in</span>
          </button>
        )}
      </div>
    </div>
  );
}
