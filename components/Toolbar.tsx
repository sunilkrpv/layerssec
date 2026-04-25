'use client';

import { useState } from 'react';
import {
  Trash2, Clock,
  FolderOpen, Copy, ClipboardPaste,
  ShieldAlert, LayoutDashboard, ChevronDown,
  Sparkles, History, Lock, GitCompareArrows, Sword, Shield,
  Save, Loader2, ImageDown,
  Gauge, MoreHorizontal, PanelRight,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import AboutModal from '@/components/AboutModal';
import { Button } from '@/components/ui/Button';
import { DropdownMenu } from '@/components/ui/DropdownMenu';

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
  /** Current active right-inspector — drives the Inspect button active state. */
  inspectorKind?: 'none' | 'ai' | 'threat' | 'posture' | 'attack' | 'layers' | 'properties' | 'edge';
  /** Switch right inspector. */
  onInspect?: (kind: 'none' | 'ai' | 'threat' | 'posture' | 'attack' | 'layers') => void;
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
  inspectorKind,
  onInspect,
  isCloudProject,
  onPublish,
  onOpenDiff,
  onExportPng,
  pipelinePhase,
}: ToolbarProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const postureScoreColor =
    postureScore == null ? '' :
    postureScore >= 80 ? 'bg-green-500' :
    postureScore >= 60 ? 'bg-amber-400' :
    postureScore >= 40 ? 'bg-orange-500' :
    'bg-red-500';

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
                <Button
                  variant="primary"
                  onClick={onSaveFile}
                  disabled={isSaving}
                  title={isSaving ? 'Saving…' : 'Save to cloud now'}
                  className="h-8 px-2.5 py-0 text-xs"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
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

          {/* Publish */}
          {isCloudProject && !isReadOnly && onPublish && (
            <>
              <div className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-600" />
              <Button
                variant="primary"
                onClick={onPublish}
                title="Publish diagram…"
                className="h-8 px-2.5 py-0 text-xs"
              >
                <Lock size={13} />
                Publish
              </Button>
            </>
          )}
          <Divider />
        </>
      )}

      {/* ── Overflow menu (Copy / Paste / Diff / Export / Clear) ──────────── */}
      <DropdownMenu
        trigger={
          <button
            type="button"
            aria-label="More actions"
            title="More actions"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <MoreHorizontal size={16} />
          </button>
        }
        items={[
          { value: 'copy', label: 'Copy (⌘C)', icon: <Copy size={13} />, onSelect: onCopy },
          ...(!isReadOnly ? [{ value: 'paste', label: 'Paste (⌘V)', icon: <ClipboardPaste size={13} />, onSelect: onPaste }] : []),
          ...(onOpenDiff ? [{ value: 'diff', label: 'Compare versions', icon: <GitCompareArrows size={13} />, onSelect: onOpenDiff }] : []),
          ...(onExportPng ? [{ value: 'export', label: 'Export as PNG (⌘⇧E)', icon: <ImageDown size={13} />, onSelect: onExportPng }] : []),
          ...(!isReadOnly ? [{ value: 'clear', label: 'Clear canvas', icon: <Trash2 size={13} />, variant: 'destructive' as const, onSelect: onClear }] : []),
        ]}
      />

      {/* ── Inspect popover ───────────────────────────────────────────────── */}
      {onInspect && (
        <>
          <Divider />
          <DropdownMenu
            trigger={
              <button
                type="button"
                aria-label="Inspect panel"
                title="Inspect panel (⌘I)"
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                  inspectorKind && inspectorKind !== 'none'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <PanelRight size={14} />
                <span>Inspect</span>
                {inspectorKind === 'posture' && postureScore != null && (
                  <span className={`ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${postureScoreColor}`}>
                    {postureScore}
                  </span>
                )}
                <ChevronDown size={11} />
              </button>
            }
            items={[
              ...(onShowAI ? [{ value: 'ai', label: 'AI Assistant (⌘I)', icon: <Sparkles size={13} className="text-blue-500" />, onSelect: () => onInspect('ai') }] : []),
              ...(onOpenThreatModel ? [{ value: 'threat', label: 'Threat Model (⌘⇧M)', icon: <ShieldAlert size={13} className="text-red-500" />, onSelect: () => onInspect('threat') }] : []),
              ...(onOpenPostureScore ? [{ value: 'posture', label: 'Posture Score', icon: <Gauge size={13} className="text-blue-500" />, onSelect: () => onInspect('posture') }] : []),
              ...(onOpenAttackMind ? [{ value: 'attack', label: 'Attack Mind', icon: <Sword size={13} className="text-red-500" />, onSelect: () => onInspect('attack') }] : []),
              ...(onOpenThreatDashboard ? [{ value: 'threat-dashboard', label: 'Open Threats Dashboard →', icon: <LayoutDashboard size={13} className="text-slate-400" />, onSelect: onOpenThreatDashboard }] : []),
              ...(onShowAIHistory ? [{ value: 'ai-history', label: 'AI History →', icon: <History size={13} className="text-slate-400" />, onSelect: onShowAIHistory }] : []),
              ...(onShowSecurityIntel ? [{ value: 'security-intel', label: 'Security Intel →', icon: <Shield size={13} className="text-slate-400" />, onSelect: onShowSecurityIntel }] : []),
            ]}
          />
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
