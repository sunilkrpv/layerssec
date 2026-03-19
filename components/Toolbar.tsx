'use client';

import { useState, useRef, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import {
  ZoomIn, ZoomOut, Maximize2, Trash2, Save, Clock,
  Zap, Loader2, FolderOpen, Copy, ClipboardPaste,
  ShieldAlert, ShieldCheck, LayoutDashboard, ChevronDown,
  Sparkles, History, Lock, GitCompareArrows,
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
  /** When true: published read-only view — hides save/paste/delete/animate */
  isReadOnly?: boolean;
  /** Open the Threat Model overlay panel */
  onOpenThreatModel?: () => void;
  /** Navigate to Threats Dashboard */
  onOpenThreatDashboard?: () => void;
  /** Open AI Assistant panel */
  onShowAI?: () => void;
  /** Open AI History page */
  onShowAIHistory?: () => void;
  /** Whether this is a cloud project (shows Publish button) */
  isCloudProject?: boolean;
  /** Publish the current diagram */
  onPublish?: () => void;
  /** Open the diff view */
  onOpenDiff?: () => void;
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
  isReadOnly = false,
  onOpenThreatModel,
  onOpenThreatDashboard,
  onShowAI,
  onShowAIHistory,
  isCloudProject,
  onPublish,
  onOpenDiff,
}: ToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [threatMenuOpen, setThreatMenuOpen] = useState(false);
  const threatBtnRef = useRef<HTMLButtonElement>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const aiBtnRef = useRef<HTMLButtonElement>(null);

  // Close threat dropdown on outside click
  useEffect(() => {
    if (!threatMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (threatBtnRef.current && !threatBtnRef.current.closest('[data-threat-menu]')?.contains(e.target as Node)) {
        setThreatMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [threatMenuOpen]);

  // Close AI dropdown on outside click
  useEffect(() => {
    if (!aiMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (aiBtnRef.current && !aiBtnRef.current.closest('[data-ai-menu]')?.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aiMenuOpen]);

  const showThreatBtn = onOpenThreatModel || onOpenThreatDashboard;

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1.5 border-b border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">

      {/* ── My Projects ─────────────────────────────────────────── */}
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

      {/* ── Save / Auto Save (editing mode only) ─────────────────────────── */}
      {!isReadOnly && (
        <>
          <BtnGroup>
            <button
              onClick={onSaveFile}
              disabled={(!hasFileHandle && !hasCloudProject) || isSaving}
              title={
                isSaving
                  ? 'Saving…'
                  : hasCloudProject
                    ? 'Save to cloud now (⌘⇧S)'
                    : hasFileHandle
                      ? 'Save to file now (⌘⇧S)'
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

            <button
              onClick={onToggleAutoSave}
              title={autoSave ? 'Auto Save is ON — click to disable' : 'Auto Save is OFF — click to enable'}
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

          {/* Publish + Diff */}
          {(isCloudProject && !isReadOnly && onPublish || onOpenDiff) && (
            <>
              <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-600" />
              {isCloudProject && !isReadOnly && onPublish && (
                <button
                  onClick={onPublish}
                  title="Publish diagram…"
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                >
                  <Lock size={13} />
                  Publish
                </button>
              )}
              {onOpenDiff && (
                <button
                  onClick={onOpenDiff}
                  title="Compare diagram versions (Diff)"
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <GitCompareArrows size={13} />
                  Diff
                </button>
              )}
            </>
          )}
          <Divider />
        </>
      )}

      {/* ── Copy (+ Paste + Delete in editing mode) ───────────────────────── */}
      <BtnGroup>
        <ToolBtn onClick={onCopy} title="Copy selected nodes (⌘C)">
          <Copy size={16} />
        </ToolBtn>
        {!isReadOnly && (
          <>
            <ToolBtn onClick={onPaste} title="Paste (⌘V)">
              <ClipboardPaste size={16} />
            </ToolBtn>
            <ToolBtn onClick={onClear} title="Clear canvas" danger>
              <Trash2 size={16} />
            </ToolBtn>
          </>
        )}
      </BtnGroup>

      <Divider />

      {/* ── Zoom controls (+ Animate in editing mode) ─────────────────────── */}
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
        {!isReadOnly && (
          <>
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
          </>
        )}
      </BtnGroup>

      {/* ── Threat Model dropdown (shown only for cloud projects) ─────────── */}
      {showThreatBtn && (
        <>
          <Divider />
          <div className="relative" data-threat-menu="">
            <BtnGroup>
              <button
                ref={threatBtnRef}
                onClick={() => setThreatMenuOpen((v) => !v)}
                title="Threat Model"
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                  threatMenuOpen
                    ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <ShieldAlert size={14} />
                <span>Threat Model</span>
                <ChevronDown size={11} className={`transition-transform ${threatMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </BtnGroup>

            {threatMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {onOpenThreatModel && (
                  <button
                    onClick={() => { onOpenThreatModel(); setThreatMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <ShieldCheck size={14} className="flex-shrink-0 text-red-500" />
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">View</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Overlay panel · ⌘⇧M</p>
                    </div>
                  </button>
                )}
                {onOpenThreatDashboard && (
                  <button
                    onClick={() => { onOpenThreatDashboard(); setThreatMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <LayoutDashboard size={14} className="flex-shrink-0 text-red-500" />
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Dashboard</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Full threat management</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── AI dropdown ───────────────────────────────────────────────────── */}
      {(onShowAI || onShowAIHistory) && (
        <>
          <Divider />
          <div className="relative" data-ai-menu="">
            <BtnGroup>
              <button
                ref={aiBtnRef}
                onClick={() => setAiMenuOpen((v) => !v)}
                title="AI"
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                  aiMenuOpen
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles size={14} />
                <span>AI</span>
                <ChevronDown size={11} className={`transition-transform ${aiMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </BtnGroup>

            {aiMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {onShowAI && (
                  <button
                    onClick={() => { onShowAI(); setAiMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <Sparkles size={14} className="flex-shrink-0 text-blue-500" />
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Open Assistant</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">AI chat panel · ⌘I</p>
                    </div>
                  </button>
                )}
                {onShowAIHistory && (
                  <button
                    onClick={() => { onShowAIHistory(); setAiMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <History size={14} className="flex-shrink-0 text-blue-500" />
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">History</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Past AI generations &amp; chat</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Last saved indicator (editing mode only, trailing) ────────────── */}
      {!isReadOnly && lastSaved && (hasFileHandle || hasCloudProject) && (
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
