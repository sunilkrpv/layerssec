'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck, ArrowLeft, Loader2, AlertCircle,
  Search, Filter, Bot, User, Trash2, ShieldOff,
  ExternalLink, Plus, Layers, Sun, Moon, Monitor, LogOut, X, FileText,
} from 'lucide-react';
import {
  apiListProjectThreats, apiUpdateThreat, apiDeleteThreat,
  apiCreateThreat, apiListThreatModels, apiGetProject, apiExportThreatReport,
  type ProjectThreat, type ThreatSeverity, type StrideCategory,
  type ThreatStatus, type ThreatModelSummary, type ThreatItem,
} from '@/lib/api';
import { getStoredUser, clearTokens } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

// ── Config ────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

const SEVERITY_BADGE: Record<ThreatSeverity, string> = {
  CRITICAL: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700',
  HIGH:     'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700',
  MEDIUM:   'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700',
  LOW:      'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700',
  INFO:     'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600',
};

const STRIDE_LABEL: Record<StrideCategory, string> = {
  SPOOFING:               'Spoofing',
  TAMPERING:              'Tampering',
  REPUDIATION:            'Repudiation',
  INFORMATION_DISCLOSURE: 'Info Disclosure',
  DENIAL_OF_SERVICE:      'Denial of Service',
  ELEVATION_OF_PRIVILEGE: 'Elevation of Priv.',
};

const STRIDE_OPTIONS = Object.keys(STRIDE_LABEL) as StrideCategory[];

const STATUS_BADGE: Record<ThreatStatus, { label: string; cls: string }> = {
  IDENTIFIED:    { label: 'Identified',    cls: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600' },
  IN_PROGRESS:   { label: 'In Progress',   cls: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' },
  MITIGATED:     { label: 'Mitigated',     cls: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' },
  ACCEPTED:      { label: 'Accepted',      cls: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700' },
  FALSE_POSITIVE:{ label: 'Dismissed',     cls: 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
};

const STATUS_OPTIONS: ThreatStatus[] = ['IDENTIFIED', 'IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'FALSE_POSITIVE'];
const SEVERITY_OPTIONS: ThreatSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Add Threat Modal ──────────────────────────────────────────────────────────

interface AddThreatModalProps {
  projectId: string;
  models: ThreatModelSummary[];
  onClose: () => void;
  onCreated: (threat: ProjectThreat) => void;
}

const EMPTY_ADD = {
  threatModelId: '',
  title: '',
  targetLabel: '',
  description: '',
  strideCategory: 'SPOOFING' as StrideCategory,
  severity: 'MEDIUM' as ThreatSeverity,
};

function AddThreatModal({ models, onClose, onCreated }: AddThreatModalProps) {
  const [form, setForm] = useState({ ...EMPTY_ADD, threatModelId: models[0]?.id ?? '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async () => {
    if (!form.threatModelId || !form.title.trim()) { setErr('Title and model are required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload: ThreatItem & { mitigationNotes?: string } = {
        targetId: `user-${Date.now()}`,
        targetType: 'node',
        targetLabel: form.targetLabel || 'General',
        layerId: 'root',
        strideCategory: form.strideCategory,
        title: form.title,
        description: form.description,
        severity: form.severity,
      };
      const created = await apiCreateThreat(form.threatModelId, payload);
      // Wrap as ProjectThreat — model info will be approximated from selection
      const model = models.find((m) => m.id === form.threatModelId);
      const full: ProjectThreat = {
        ...created,
        threatModel: {
          id: form.threatModelId,
          name: model?.name ?? '',
          diagramVersion: model?.diagramVersion ?? 1,
          savedAt: model?.savedAt ?? new Date().toISOString(),
          diagramId: '',
        },
      };
      onCreated(full);
      onClose();
    } catch (e) {
      setErr((e as Error).message || 'Failed to create threat');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Add Threat</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Threat Model *</label>
            <select
              value={form.threatModelId}
              onChange={(e) => setForm((f) => ({ ...f, threatModelId: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name} (v{m.diagramVersion})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Unauthenticated access to admin API"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Target Component</label>
            <input
              value={form.targetLabel}
              onChange={(e) => setForm((f) => ({ ...f, targetLabel: e.target.value }))}
              placeholder="e.g. AuthService, PostgreSQL"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">STRIDE</label>
              <select
                value={form.strideCategory}
                onChange={(e) => setForm((f) => ({ ...f, strideCategory: e.target.value as StrideCategory }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {STRIDE_OPTIONS.map((s) => <option key={s} value={s}>{STRIDE_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Severity</label>
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as ThreatSeverity }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the threat…"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button onClick={onClose} className="rounded-lg px-4 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add Threat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 10;

interface Props {
  projectId: string;
}

export default function ThreatsDashboardPage({ projectId }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const storedUser = getStoredUser();

  const [projectName, setProjectName] = useState<string | null>(null);
  const [threatModels, setThreatModels] = useState<ThreatModelSummary[]>([]);
  const [result, setResult] = useState<{ data: ProjectThreat[]; total: number; summary: { totalActive: number; mitigated: number; critical: number; high: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<ThreatSeverity | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<ThreatStatus | 'ALL'>('ALL');
  const [filterStride, setFilterStride] = useState<StrideCategory | 'ALL'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  // Debounce search input by 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [debouncedSearch, filterSeverity, filterStatus, filterStride]);

  // Initial load: project name + threat models (sidebar meta, doesn't change per page)
  useEffect(() => {
    Promise.all([apiListThreatModels(projectId), apiGetProject(projectId)])
      .then(([m, p]) => { setThreatModels(m); setProjectName(p.name); })
      .catch((e) => setError(e.message || 'Failed to load project'));
  }, [projectId]);

  // Fetch threats from backend whenever page or filters change
  useEffect(() => {
    setTableLoading(true);
    apiListProjectThreats(projectId, {
      page,
      limit: PAGE_LIMIT,
      search: debouncedSearch || undefined,
      severity: filterSeverity !== 'ALL' ? filterSeverity : undefined,
      status: filterStatus !== 'ALL' ? filterStatus : undefined,
      strideCategory: filterStride !== 'ALL' ? filterStride : undefined,
    })
      .then((r) => { setResult(r); setError(null); })
      .catch((e) => setError(e.message || 'Failed to load threats'))
      .finally(() => { setLoading(false); setTableLoading(false); });
  }, [projectId, page, debouncedSearch, filterSeverity, filterStatus, filterStride]);

  const threats = result?.data ?? [];
  const total = result?.total ?? 0;
  const summary = result?.summary;
  const totalPages = Math.ceil(total / PAGE_LIMIT);

  const handleStatusChange = async (t: ProjectThreat, newStatus: ThreatStatus) => {
    setUpdatingId(t.id);
    try {
      await apiUpdateThreat(t.threatModel.id, t.id, { status: newStatus });
      // Re-fetch current page so filters stay consistent
      setResult((prev) => prev
        ? { ...prev, data: prev.data.map((x) => x.id === t.id ? { ...x, status: newStatus } : x) }
        : prev,
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDismiss = async (t: ProjectThreat) => {
    const newStatus: ThreatStatus = t.status === 'FALSE_POSITIVE' ? 'IDENTIFIED' : 'FALSE_POSITIVE';
    await handleStatusChange(t, newStatus);
  };

  const handleDelete = async (t: ProjectThreat) => {
    setUpdatingId(t.id);
    try {
      await apiDeleteThreat(t.threatModel.id, t.id);
      setResult((prev) => prev
        ? { ...prev, data: prev.data.filter((x) => x.id !== t.id), total: prev.total - 1 }
        : prev,
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    setTheme(cycle[(cycle.indexOf(theme) + 1) % cycle.length]);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <Layers size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Drafter</span>
        </div>

        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-1.5 rounded px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <ArrowLeft size={13} />
          Back to diagram
        </button>

        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-red-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {projectName ? `${projectName} — Threats` : 'Threats Dashboard'}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {threatModels.length > 0 && (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <Plus size={12} />
                Add Threat
              </button>
              <button
                onClick={async () => {
                  setExportingReport(true);
                  try { await apiExportThreatReport(projectId); }
                  finally { setExportingReport(false); }
                }}
                disabled={exportingReport}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white disabled:opacity-50"
                title="Export as PDF report"
              >
                {exportingReport
                  ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                  : <><FileText size={12} /> Export Report</>}
              </button>
            </>
          )}

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          <button
            onClick={cycleTheme}
            title={`Theme: ${theme} — click to cycle`}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {theme === 'light' ? <Sun size={14} /> : theme === 'dark' ? <Moon size={14} /> : <Monitor size={14} />}
            <span className="hidden sm:inline capitalize">{theme}</span>
          </button>

          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {storedUser && (
            <button
              onClick={() => { clearTokens(); router.push('/projects/local'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">
                {storedUser.email}
              </span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* ── Main scrollable area ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">

          {/* Summary cards — from backend summary (always unfiltered totals) */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Active', value: summary?.totalActive ?? 0, cls: 'text-slate-900 dark:text-slate-100' },
              { label: 'Mitigated',    value: summary?.mitigated ?? 0,   cls: 'text-green-600 dark:text-green-400' },
              { label: 'Critical',     value: summary?.critical ?? 0,    cls: 'text-red-600 dark:text-red-400' },
              { label: 'High',         value: summary?.high ?? 0,        cls: 'text-orange-600 dark:text-orange-400' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search threats…"
                className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 focus:ring-red-400/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter size={12} className="text-slate-400 flex-shrink-0" />
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as ThreatSeverity | 'ALL')}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All severities</option>
                {SEVERITY_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ThreatStatus | 'ALL')}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All statuses</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
              </select>

              <select
                value={filterStride}
                onChange={(e) => setFilterStride(e.target.value as StrideCategory | 'ALL')}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All STRIDE</option>
                {STRIDE_OPTIONS.map((s) => <option key={s} value={s}>{STRIDE_LABEL[s]}</option>)}
              </select>
            </div>

            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              {tableLoading && <Loader2 size={11} className="animate-spin" />}
              {total} result{total !== 1 ? 's' : ''}
              {totalPages > 1 ? ` · page ${page + 1}/${totalPages}` : ''}
            </span>
          </div>

          {/* Table / states */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ShieldCheck size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {!result ? 'Loading…' : threatModels.length === 0
                  ? 'No threats saved yet. Run a threat analysis from the diagram view.'
                  : 'No threats match your filters.'}
              </p>
              {threatModels.length === 0 && (
                <button
                  onClick={() => router.push(`/projects/${projectId}`)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white transition dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <ArrowLeft size={13} /> Go to diagram
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 transition-opacity ${tableLoading ? 'opacity-60' : ''}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Threat</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">Target</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">STRIDE</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">Layer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden xl:table-cell">Source</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {threats.map((t) => {
                      const statusInfo = STATUS_BADGE[t.status];
                      const isDismissed = t.status === 'FALSE_POSITIVE';
                      return (
                        <tr
                          key={t.id}
                          className={`group transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${isDismissed ? 'opacity-50' : ''}`}
                        >
                          <td className="px-4 py-3 max-w-[220px]">
                            <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{t.title}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{t.description}</p>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-slate-600 dark:text-slate-300 text-xs">{t.targetLabel}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${SEVERITY_BADGE[t.severity]}`}>
                              {t.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs text-slate-500 dark:text-slate-400">{STRIDE_LABEL[t.strideCategory]}</span>
                          </td>
                          <td className="px-4 py-3">
                            {updatingId === t.id ? (
                              <Loader2 size={14} className="animate-spin text-slate-400" />
                            ) : (
                              <select
                                value={t.status}
                                onChange={(e) => handleStatusChange(t, e.target.value as ThreatStatus)}
                                className={`rounded-md border px-2 py-0.5 text-xs font-medium outline-none cursor-pointer ${statusInfo.cls}`}
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>{STATUS_BADGE[s].label}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <a
                              href={`/projects/${projectId}?currLayer=${t.layerId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open layer in diagram: ${t.layerId}`}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              {t.layerId.slice(-8)}
                              <ExternalLink size={9} />
                            </a>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              <p className="truncate max-w-[130px]">{t.threatModel.name}</p>
                              <p className="text-slate-400 dark:text-slate-500">v{t.threatModel.diagramVersion} · {formatDate(t.threatModel.savedAt)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                              t.identifiedBy === 'AI'
                                ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700'
                                : 'text-teal-600 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/40 border-teal-200 dark:border-teal-700'
                            }`}>
                              {t.identifiedBy === 'AI' ? <Bot size={9} /> : <User size={9} />}
                              {t.identifiedBy === 'AI' ? 'AI' : 'User'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleDismiss(t)}
                                title={isDismissed ? 'Re-open threat' : 'Dismiss as false positive'}
                                className="rounded p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                              >
                                <ShieldOff size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(t)}
                                title="Delete threat"
                                className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                              <a
                                href={`/projects/${projectId}?threatModel=${t.threatModel.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View in diagram (new tab)"
                                className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || tableLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white transition disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    ← Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={`h-7 w-7 rounded-md text-xs font-medium transition ${
                          i === page
                            ? 'bg-red-600 text-white'
                            : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1 || tableLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-white transition disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddThreatModal
          projectId={projectId}
          models={threatModels}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            // Re-fetch page 0 to show the new threat
            setPage(0);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
