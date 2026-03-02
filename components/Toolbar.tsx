'use client';

import { useReactFlow } from 'reactflow';
import {
  ZoomIn, ZoomOut, Maximize2, Trash2, Save, Clock,
  Zap, Loader2, FolderOpen, Copy, ClipboardPaste,
} from 'lucide-react';

interface ToolbarProps {
  onClear: () => void;
  /** Whether a local file is currently open (handle exists) */
  hasFileHandle: boolean;
  /** Whether a cloud project is currently open */
  hasCloudProject: boolean;
  /** Whether auto-save is enabled */
  autoSave: boolean;
  onToggleAutoSave: () => void;
  /** Manually trigger a save */
  onSaveFile: () => void;
  /** True while a manual save is in flight */
  isSaving: boolean;
  /** ISO string of last auto-save time, or null */
  lastSaved: Date | null;
  /** Whether edge/line animations are enabled */
  animateEdges: boolean;
  onToggleAnimateEdges: () => void;
  /** Navigate to My Projects page (shown only when provided) */
  onMyProjects?: () => void;
  /** Copy selected canvas nodes */
  onCopy: () => void;
  /** Paste clipboard nodes onto canvas */
  onPaste: () => void;
}

function ToolBtn({
  onClick,
  title,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-600" />;
}

function BtnGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800">
      {children}
    </div>
  );
}

function formatLastSaved(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  return `${mins}m ago`;
}

export default function Toolbar({
  onClear,
  hasFileHandle,
  hasCloudProject,
  autoSave,
  onToggleAutoSave,
  onSaveFile,
  isSaving,
  lastSaved,
  animateEdges,
  onToggleAnimateEdges,
  onMyProjects,
  onCopy,
  onPaste,
}: ToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1.5 border-b border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">

      {/* ── My Projects ─────────────────────────────────────── */}
      {onMyProjects && (
        <>
          <BtnGroup>
            <ToolBtn onClick={onMyProjects} title="My Projects (⌘P)">
              <FolderOpen size={16} />
            </ToolBtn>
          </BtnGroup>
          <Divider />
        </>
      )}

      {/* ── Save / Auto Save ─────────────────────────────────── */}
      <BtnGroup>
        {/* Manual save */}
        <button
          onClick={onSaveFile}
          disabled={(!hasFileHandle && !hasCloudProject) || isSaving}
          title={
            isSaving
              ? 'Saving…'
              : hasCloudProject
                ? 'Save to cloud now (⌘S)'
                : hasFileHandle
                  ? 'Save to file now (⌘S)'
                  : 'Open a project file or cloud project first'
          }
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {isSaving
            ? <Loader2 size={13} className="animate-spin" />
            : <Save size={13} />}
          {isSaving ? 'Saving…' : 'Save'}
        </button>

        <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-600" />

        {/* Auto-save toggle */}
        <button
          onClick={onToggleAutoSave}
          title={
            autoSave
              ? 'Auto Save is ON — click to disable'
              : 'Auto Save is OFF — click to enable'
          }
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
            autoSave && (hasFileHandle || hasCloudProject)
              ? 'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
              : autoSave
                ? 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              autoSave && (hasFileHandle || hasCloudProject)
                ? 'bg-green-500'
                : autoSave
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
            }`}
          />
          Auto {autoSave ? 'ON' : 'OFF'}
        </button>
      </BtnGroup>

      <Divider />

      {/* ── Copy / Paste / Delete ─────────────────────────────── */}
      <BtnGroup>
        <ToolBtn onClick={onCopy} title="Copy selected nodes (⌘C)">
          <Copy size={16} />
        </ToolBtn>
        <ToolBtn onClick={onPaste} title="Paste (⌘V)">
          <ClipboardPaste size={16} />
        </ToolBtn>
        <ToolBtn onClick={onClear} title="Clear canvas" danger>
          <Trash2 size={16} />
        </ToolBtn>
      </BtnGroup>

      <Divider />

      {/* ── Zoom controls + Animate ───────────────────────────── */}
      <BtnGroup>
        <ToolBtn onClick={() => zoomIn()} title="Zoom In">
          <ZoomIn size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => zoomOut()} title="Zoom Out">
          <ZoomOut size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => fitView({ padding: 0.15 })} title="Fit View">
          <Maximize2 size={16} />
        </ToolBtn>
        <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-600" />
        <button
          onClick={onToggleAnimateEdges}
          title={animateEdges ? 'Animations ON — click to disable' : 'Animations OFF — click to enable'}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            animateEdges
              ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Zap size={16} />
        </button>
      </BtnGroup>

      {/* ── Last saved indicator (trailing) ──────────────────── */}
      {lastSaved && (hasFileHandle || hasCloudProject) && (
        <span
          className="ml-auto flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"
          title={`Last saved: ${lastSaved.toLocaleTimeString()}`}
        >
          <Clock size={11} />
          {formatLastSaved(lastSaved)}
        </span>
      )}
    </div>
  );
}
