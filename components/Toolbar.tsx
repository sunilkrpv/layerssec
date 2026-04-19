'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Trash2, Clock,
  FolderOpen, Copy, ClipboardPaste,
  ShieldAlert, ShieldCheck, LayoutDashboard, ChevronDown,
  Sparkles, History, Lock, GitCompareArrows, Sword, Shield,
  Save, Loader2, ImageDown,
  Gauge, Undo2, Redo2,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import AboutModal from '@/components/AboutModal';

interface ToolbarProps {
  onClear: () => void;
  /** Whether auto-save is enabled */
  autoSave: boolean;
  onToggleAutoSave: () => void;
  /** ISO string of last auto-save time, or null */
  lastSaved: Date | null;
  /** Manually save the diagram to cloud now */
  onSaveFile?: () => void;
  /** Whether a save is currently in progress */
  isSaving?: boolean;
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
  /** Open Security Posture Score panel */
  onOpenPostureScore?: () => void;
  /** Latest computed posture score (0-100) to show as a badge */
  postureScore?: number | null;
  /** Open Attack Mind Simulator panel */
  onOpenAttackMind?: () => void;
  /** Open AI Assistant panel */
  onShowAI?: () => void;
  /** Open AI History page */
  onShowAIHistory?: () => void;
  /** Open Security Intel page */
  onShowSecurityIntel?: () => void;
  /** Whether this is a cloud project (shows Publish button) */
  isCloudProject?: boolean;
  /** Publish the current diagram */
  onPublish?: () => void;
  /** Open the diff view */
  onOpenDiff?: () => void;
  /** Export the current canvas layer as PNG */
  onExportPng?: () => void;
  /** Current security pipeline phase — shows dot indicator on Shield icon */
  pipelinePhase?: 'idle' | 'nudge' | 'threat_running' | 'threat_done' | 'posture_running' | 'complete';
  /** Undo the last diagram change (⌘Z) */
  onUndo?: () => void;
  /** Redo the last undone diagram change (⌘⇧Z / ⌘Y) */
  onRedo?: () => void;
  /** Whether the undo stack has any entries */
  canUndo?: boolean;
  /** Whether the redo stack has any entries */
  canRedo?: boolean;
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
  autoSave,
  onToggleAutoSave,
  lastSaved,
  onSaveFile,
  isSaving = false,
  onMyProjects,
  onCopy,
  onPaste,
  isReadOnly = false,
  onOpenThreatModel,
  onOpenThreatDashboard,
  onOpenPostureScore,
  postureScore,
  onOpenAttackMind,
  onShowAI,
  onShowAIHistory,
  onShowSecurityIntel,
  isCloudProject,
  onPublish,
  onOpenDiff,
  onExportPng,
  pipelinePhase,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: ToolbarProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [threatMenuOpen, setThreatMenuOpen] = useState(false);
  const threatBtnRef = useRef<HTMLButtonElement>(null);
  const postureScoreColor =
    postureScore == null ? '' :
    postureScore >= 80 ? 'bg-green-500' :
    postureScore >= 60 ? 'bg-amber-400' :
    postureScore >= 40 ? 'bg-orange-500' :
    'bg-red-500';
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

  const showThreatBtn = onOpenThreatModel || onOpenThreatDashboard || onOpenPostureScore || onOpenAttackMind;

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-1.5 border-b border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">

      {/* ── About (Layers logo) ─────────────────────────────────── */}
      <BtnGroup>
        <button
          onClick={() => setAboutOpen(true)}
          title="About Layers"
          aria-label="About Layers"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-700"
        >
          <LayersLogo size={14} />
        </button>
      </BtnGroup>
      <Divider />

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

      {/* ── Auto Save (editing mode only) ─────────────────────────────────── */}
      {!isReadOnly && (
        <>
          <BtnGroup>
            {onSaveFile && (
              <>
                <button
                  onClick={onSaveFile}
                  disabled={isSaving}
                  title={isSaving ? 'Saving…' : 'Save to cloud now'}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
                <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-600" />
              </>
            )}
            <button
              onClick={onToggleAutoSave}
              title={autoSave ? 'Auto Save is ON — click to disable' : 'Auto Save is OFF — click to enable'}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                autoSave
                  ? 'text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  autoSave ? 'bg-green-500' : 'bg-slate-400'
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
              {onExportPng && (
                <button
                  onClick={onExportPng}
                  title="Save canvas as PNG (⌘⇧E)"
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <ImageDown size={13} />
                  Export PNG
                </button>
              )}
            </>
          )}
          {!(isCloudProject && !isReadOnly && onPublish || onOpenDiff) && onExportPng && (
            <>
              <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-600" />
              <button
                onClick={onExportPng}
                title="Save canvas as PNG (⌘⇧E)"
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <ImageDown size={13} />
                Export PNG
              </button>
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

      {/* ── Undo / Redo (editing mode only) ─────────────────────────────── */}
      {!isReadOnly && onUndo && onRedo && (
        <BtnGroup>
          <ToolBtn
            onClick={onUndo}
            title="Undo (⌘Z)"
            disabled={!canUndo}
          >
            <Undo2 size={16} />
          </ToolBtn>
          <ToolBtn
            onClick={onRedo}
            title="Redo (⌘⇧Z)"
            disabled={!canRedo}
          >
            <Redo2 size={16} />
          </ToolBtn>
        </BtnGroup>
      )}

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
                {postureScore != null && (
                  <span className={`ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${postureScoreColor}`}>
                    {postureScore}
                  </span>
                )}
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
                {(onOpenPostureScore || onOpenAttackMind) && (onOpenThreatModel || onOpenThreatDashboard) && (
                  <div className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
                )}
                {onOpenPostureScore && (
                  <button
                    onClick={() => { onOpenPostureScore(); setThreatMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <Gauge size={14} className="flex-shrink-0 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Posture Score</p>
                        {postureScore != null && (
                          <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${postureScoreColor}`}>
                            {postureScore}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Security health assessment</p>
                    </div>
                  </button>
                )}
                {onOpenAttackMind && (
                  <button
                    onClick={() => { onOpenAttackMind(); setThreatMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <Sword size={14} className="flex-shrink-0 text-red-500" />
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Attack Mind</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Red-team attack simulation</p>
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
                {onShowSecurityIntel && (
                  <button
                    onClick={() => { onShowSecurityIntel(); setAiMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <Shield size={14} className="flex-shrink-0 text-blue-500" />
                    <div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">Security Intel</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Unified risk summary &amp; report</p>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Security pipeline phase indicator ────────────────────────────── */}
      {pipelinePhase && pipelinePhase !== 'idle' && (
        <div
          className="relative flex h-7 w-7 items-center justify-center rounded text-slate-500 dark:text-slate-400"
          title={
            pipelinePhase === 'nudge' ? 'Security analysis ready — open AI panel'
            : pipelinePhase === 'threat_running' ? 'Threat analysis running…'
            : pipelinePhase === 'threat_done' ? 'Threat analysis complete — run posture score'
            : pipelinePhase === 'posture_running' ? 'Scoring security posture…'
            : 'Security pipeline complete'
          }
        >
          <Shield size={14} />
          <span className={`absolute right-0 top-0 h-2 w-2 rounded-full ${
            pipelinePhase === 'complete' ? 'bg-emerald-500'
            : pipelinePhase === 'nudge' || pipelinePhase === 'threat_done' ? 'bg-blue-500'
            : 'bg-amber-400 animate-pulse'
          }`} />
        </div>
      )}

      {/* ── Last saved indicator (editing mode only, trailing) ────────────── */}
      {!isReadOnly && lastSaved && (
        <span
          className="ml-auto flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"
          title={`Last saved: ${lastSaved.toLocaleTimeString()}`}
        >
          <Clock size={11} />
          {formatLastSaved(lastSaved)}
        </span>
      )}

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
