'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, LogIn, LogOut, User, Sun, Moon, Monitor, Lock, Layers } from 'lucide-react';
import { useTheme } from '@/lib/themeContext';
import type { Theme } from '@/lib/themeStore';

interface MenuBarProps {
  onNew: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  hasFileHandle: boolean;
  onImportJson: (file: File) => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onImportProject: (file: File) => void;
  onExportProject: () => void;
  onOpenDiff: () => void;
  layersVisible: boolean;
  onToggleLayers: () => void;
  /** Logged-in user email; null/undefined = not logged in */
  userEmail?: string | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  /** Whether a cloud project (not local) is currently open */
  isCloudProject?: boolean;
  /** Whether the currently open diagram is read-only (published) */
  isReadOnly?: boolean;
  /** Called when user clicks Publish… */
  onPublish?: () => void;
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return { open, setOpen, ref };
}

function MenuItem({
  onClick,
  children,
  shortcut,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:text-slate-600"
    >
      <span className="flex-1">{children}</span>
      {shortcut && <span className="ml-4 text-xs text-slate-400 dark:text-slate-500">{shortcut}</span>}
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />;
}

function Dropdown({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { open, setOpen, ref } = useDropdown();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`rounded px-3 py-1 text-sm ${
          open
            ? 'bg-blue-600 text-white'
            : 'text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white'
        }`}
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-0.5 min-w-[220px] rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
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
  onNew,
  onOpenFile,
  onSaveFile,
  hasFileHandle,
  onImportJson,
  onExportJson,
  onExportPng,
  onImportProject,
  onExportProject,
  onOpenDiff,
  layersVisible,
  onToggleLayers,
  userEmail,
  onSignIn,
  onSignOut,
  isCloudProject,
  isReadOnly,
  onPublish,
}: MenuBarProps) {
  const [showAbout, setShowAbout] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  return (
    <>
      <div className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        {/* Logo */}
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <Layers size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Drafter</span>
        </div>

        {/* Menu items */}
        <div className="flex items-center gap-0.5">
          <Dropdown label="File">
            <MenuItem onClick={onNew} shortcut="⌘N">
              New
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={onOpenFile} shortcut="⌘O">
              Open File…
            </MenuItem>
            <MenuItem onClick={onSaveFile} disabled={!hasFileHandle} shortcut="⌘⇧S">
              Save File
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => jsonInputRef.current?.click()}>Import Layer JSON</MenuItem>
            <MenuItem onClick={onExportJson}>Export Layer JSON</MenuItem>
            <MenuItem onClick={onExportPng} shortcut="⌘⇧E">
              Save as Image
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => projectInputRef.current?.click()}>Import Project</MenuItem>
            <MenuItem onClick={onExportProject}>Export Project</MenuItem>
            <MenuSeparator />
            <MenuItem onClick={onOpenDiff}>Diff…</MenuItem>
            {isCloudProject && !isReadOnly && onPublish && (
              <>
                <MenuSeparator />
                <MenuItem onClick={onPublish}>
                  <span className="flex items-center gap-2">
                    <Lock size={12} className="text-green-600" />
                    Publish…
                  </span>
                </MenuItem>
              </>
            )}
          </Dropdown>

          <Dropdown label="View">
            <MenuItem onClick={onToggleLayers}>
              {layersVisible ? '✓ ' : ''}Layers Panel
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={() => {}} disabled>
              Zoom In
            </MenuItem>
            <MenuItem onClick={() => {}} disabled>
              Zoom Out
            </MenuItem>
            <MenuItem onClick={() => {}} disabled>
              Fit View
            </MenuItem>
          </Dropdown>

          <button
            onClick={() => setShowAbout(true)}
            className="rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            About
          </button>
        </div>

        {/* Right side — theme toggle + user account */}
        <div className="ml-auto flex items-center gap-1">
          {/* Theme cycle button */}
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
            <>
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
                title={`Signed in as ${userEmail}`}
              >
                <User size={13} className="text-slate-500 dark:text-slate-400" />
                <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</span>
                <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
              </button>
            </>
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

        {/* Hidden file inputs */}
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onImportJson(f);
              e.target.value = '';
            }
          }}
        />
        <input
          ref={projectInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onImportProject(f);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* About modal */}
      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
              <Layers size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Drafter</h1>
            <p className="mt-1 text-base font-medium text-slate-500 dark:text-slate-400">v0.1 Alpha</p>
            <p className="mx-auto mt-4 max-w-xs text-sm text-slate-600 dark:text-slate-300">
              A layered AI-powered diagramming tool. Build architecture diagrams, drill into nodes,
              and generate diagrams with AI.
            </p>
            <div className="mt-6 flex items-center justify-center gap-1 text-xs text-slate-400 dark:text-slate-500">
              <Minus size={10} />
              <span>Built with Next.js, React Flow &amp; Claude</span>
              <Minus size={10} />
            </div>
            <button
              onClick={() => setShowAbout(false)}
              className="mt-6 rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
