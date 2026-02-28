'use client';

import { useReactFlow } from 'reactflow';
import { ZoomIn, ZoomOut, Maximize2, Trash2, Save, Clock, Zap } from 'lucide-react';

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
  /** ISO string of last auto-save time, or null */
  lastSaved: Date | null;
  /** Whether edge/line animations are enabled */
  animateEdges: boolean;
  onToggleAnimateEdges: () => void;
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
          ? 'text-red-500 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
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
  lastSaved,
  animateEdges,
  onToggleAnimateEdges,
}: ToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
      {/* Zoom controls */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5">
        <ToolBtn onClick={() => zoomIn()} title="Zoom In">
          <ZoomIn size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => zoomOut()} title="Zoom Out">
          <ZoomOut size={16} />
        </ToolBtn>
        <ToolBtn onClick={() => fitView({ padding: 0.15 })} title="Fit View">
          <Maximize2 size={16} />
        </ToolBtn>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolBtn onClick={onClear} title="Clear canvas" danger>
          <Trash2 size={16} />
        </ToolBtn>
      </div>

      {/* File save controls */}
      <div className="flex items-center gap-2">
        {/* Manual save */}
        <button
          onClick={onSaveFile}
          disabled={!hasFileHandle && !hasCloudProject}
          title={
            hasCloudProject
              ? 'Save to cloud now'
              : hasFileHandle
                ? 'Save to file now'
                : 'Open a project file or cloud project first'
          }
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={13} />
          Save
        </button>

        {/* Auto-save toggle */}
        <button
          onClick={onToggleAutoSave}
          title={
            autoSave
              ? 'Auto Save is ON (every 60s) — click to disable'
              : 'Auto Save is OFF — click to enable'
          }
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
            autoSave && hasFileHandle
              ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
              : autoSave
                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              autoSave && hasFileHandle
                ? 'bg-green-500'
                : autoSave
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
            }`}
          />
          Auto Save {autoSave ? 'ON' : 'OFF'}
        </button>

        {/* Last saved indicator */}
        {lastSaved && (hasFileHandle || hasCloudProject) && (
          <span
            className="flex items-center gap-1 text-xs text-slate-400"
            title={`Last saved: ${lastSaved.toLocaleTimeString()}`}
          >
            <Clock size={11} />
            {formatLastSaved(lastSaved)}
          </span>
        )}
      </div>

      {/* Animation toggle */}
      <div className="ml-auto">
        <button
          onClick={onToggleAnimateEdges}
          title={animateEdges ? 'Animations ON — click to disable' : 'Animations OFF — click to enable'}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
            animateEdges
              ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Zap size={12} className={animateEdges ? 'text-violet-500' : 'text-slate-400'} />
          Animate {animateEdges ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
