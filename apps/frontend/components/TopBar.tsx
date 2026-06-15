'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Sun, Moon, Monitor } from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';
import type { Theme } from '@/lib/themeStore';
import { cn } from '@/lib/utils';

const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun size={14} />,
  dark: <Moon size={14} />,
  system: <Monitor size={14} />,
};
const THEME_LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };

interface TopBarProps {
  className?: string;
}

export default function TopBar({ className }: TopBarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const user = getStoredUser();

  const cycleTheme = () => {
    setTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]);
  };

  const handleSignOut = () => {
    signOut();
    router.push('/login');
  };

  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
    >
      {/* Left: brand */}
      <button
        type="button"
        onClick={() => router.push('/home')}
        className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <LayersLogo size={18} className="text-blue-600 dark:text-blue-500" />
        <span className="text-[15px] font-bold text-slate-900 dark:text-white">Layers</span>
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Security Platform
        </span>
      </button>

      {/* Right: theme + user */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={cycleTheme}
          title={`Theme: ${THEME_LABELS[theme]} — click to cycle`}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
        >
          {THEME_ICONS[theme]}
          <span className="hidden sm:inline">{THEME_LABELS[theme]}</span>
        </button>

        {user && (
          <div className="flex items-center gap-2 rounded-md px-2 py-1">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white"
              title={user.email}
            >
              {user.email[0]?.toUpperCase()}
            </div>
            <span className="hidden text-[12px] text-slate-600 dark:text-slate-400 md:inline">
              {user.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
