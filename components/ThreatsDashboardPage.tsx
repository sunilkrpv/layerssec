'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck, ArrowLeft, Loader2, AlertCircle, Search, Plus,
  Sun, Moon, Monitor, LogOut, User, FileText,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StrideHeatMap } from '@/components/threats/StrideHeatMap';
import { FiltersPopover } from '@/components/threats/FiltersPopover';
import { ActiveFilterChips } from '@/components/threats/ActiveFilterChips';
import { ThreatsTable } from '@/components/threats/ThreatsTable';
import { AddThreatModal } from '@/components/threats/AddThreatModal';
import {
  apiListProjectThreats, apiListThreatModels, apiGetProject, apiExportThreatReport,
  type ProjectThreat, type ThreatSeverity, type ThreatStatus, type StrideCategory,
  type ThreatModelSummary, type ThreatsDashboardResult,
} from '@/lib/api';
import { getStoredUser, signOut } from '@/lib/authStore';
import { useTheme } from '@/lib/themeContext';

interface Props { projectId: string }

export default function ThreatsDashboardPage({ projectId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const storedUser = getStoredUser();

  // ── Cycle theme (light → dark → system) ────────────────────────────────
  const cycleTheme = () => {
    const cycle = ['light', 'dark', 'system'] as const;
    setTheme(cycle[(cycle.indexOf(theme as 'light' | 'dark' | 'system') + 1) % cycle.length]);
  };

  // ── Filter state (URL synced) ───────────────────────────────────────────
  const [searchText, setSearchText] = useState(searchParams.get('q') ?? '');
  const [filterSeverity, setFilterSeverity] = useState<ThreatSeverity | 'ALL'>(
    (searchParams.get('sev') as ThreatSeverity | null) ?? 'ALL',
  );
  const [filterStatus, setFilterStatus] = useState<ThreatStatus | 'ALL'>(
    (searchParams.get('status') as ThreatStatus | null) ?? 'ALL',
  );
  const [filterStride, setFilterStride] = useState<StrideCategory | 'ALL'>(
    (searchParams.get('stride') as StrideCategory | null) ?? 'ALL',
  );
  const [page, setPage] = useState(() => Math.max(0, parseInt(searchParams.get('page') ?? '1', 10) - 1));

  // ── Page data ───────────────────────────────────────────────────────────
  const [result, setResult] = useState<ThreatsDashboardResult | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threatModels, setThreatModels] = useState<ThreatModelSummary[]>([]);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Push URL on filter change (immediate) ───────────────────────────────
  useEffect(() => {
    const qs = new URLSearchParams();
    if (searchText) qs.set('q', searchText);
    if (filterSeverity !== 'ALL') qs.set('sev', filterSeverity);
    if (filterStatus !== 'ALL') qs.set('status', filterStatus);
    if (filterStride !== 'ALL') qs.set('stride', filterStride);
    if (page > 0) qs.set('page', String(page + 1));
    const next = qs.toString();
    router.replace(`/projects/${projectId}/threats${next ? `?${next}` : ''}`);
  }, [searchText, filterSeverity, filterStatus, filterStride, page, projectId, router]);

  // ── Debounced fetch (250 ms) ─────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      setTableLoading(true);
      setError(null);
      try {
        const params: Parameters<typeof apiListProjectThreats>[1] = { page, limit: 20 };
        if (searchText) params.search = searchText;
        if (filterSeverity !== 'ALL') params.severity = filterSeverity;
        if (filterStatus !== 'ALL') params.status = filterStatus;
        if (filterStride !== 'ALL') params.strideCategory = filterStride;
        const r = await apiListProjectThreats(projectId, params);
        setResult(r);
      } catch (e) {
        setError((e as Error).message || 'Failed to load threats');
      } finally {
        setTableLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [projectId, searchText, filterSeverity, filterStatus, filterStride, page, refreshKey]);

  // ── One-shot loads ──────────────────────────────────────────────────────
  useEffect(() => {
    apiGetProject(projectId).then((p) => setProjectName(p.name)).catch(() => {});
    apiListThreatModels(projectId).then(setThreatModels).catch(() => {});
  }, [projectId]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const threats = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result ? Math.max(1, Math.ceil(total / result.limit)) : 1;

  const handleHeatMapCellClick = useCallback((stride: StrideCategory, sev: ThreatSeverity) => {
    if (filterStride === stride && filterSeverity === sev) {
      setFilterStride('ALL');
      setFilterSeverity('ALL');
    } else {
      setFilterStride(stride);
      setFilterSeverity(sev);
    }
    setPage(0);
  }, [filterStride, filterSeverity]);

  const handleStatusChanged = useCallback((id: string, next: ProjectThreat) => {
    setResult((prev) => prev ? { ...prev, data: prev.data.map((t) => t.id === id ? next : t) } : prev);
  }, []);

  const handleFiltersChange = (patch: { severity?: ThreatSeverity | 'ALL'; status?: ThreatStatus | 'ALL'; stride?: StrideCategory | 'ALL' }) => {
    if (patch.severity !== undefined) setFilterSeverity(patch.severity);
    if (patch.status !== undefined) setFilterStatus(patch.status);
    if (patch.stride !== undefined) setFilterStride(patch.stride);
    setPage(0);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">

      {/* ── Top bar (secondary-page convention) ─────────────────────────── */}
      <header className="flex h-9 flex-shrink-0 items-center border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mr-4 flex items-center gap-1.5 pl-1">
          <LayersLogo size={14} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Layers</span>
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
          </button>
          <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          {storedUser && (
            <button
              onClick={() => { signOut(); router.push('/login'); }}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
              title="Sign out"
            >
              <User size={13} className="text-slate-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-slate-400">{storedUser.email}</span>
              <LogOut size={12} className="text-slate-400 dark:text-slate-500" />
            </button>
          )}
        </div>
      </header>

      {/* ── Main scrollable area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl space-y-5 px-6 py-6">

          {/* STRIDE Risk Matrix */}
          <StrideHeatMap
            threats={threats}
            activeStride={filterStride}
            activeSeverity={filterSeverity}
            onCellClick={handleHeatMapCellClick}
          />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                placeholder="Search threats…"
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 outline-none placeholder-slate-400 focus:ring-1 focus:ring-blue-400/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            <FiltersPopover
              severity={filterSeverity}
              status={filterStatus}
              stride={filterStride}
              onChange={(next) => { setFilterSeverity(next.severity); setFilterStatus(next.status); setFilterStride(next.stride); setPage(0); }}
            />
            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              {tableLoading && <Loader2 size={11} className="animate-spin" />}
              {total} result{total !== 1 ? 's' : ''}
              {totalPages > 1 ? ` · page ${page + 1}/${totalPages}` : ''}
            </span>
          </div>

          {/* Active filter chips */}
          <ActiveFilterChips
            severity={filterSeverity}
            status={filterStatus}
            stride={filterStride}
            onChange={handleFiltersChange}
          />

          {/* Threats table / empty / error states */}
          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle size={14} /> {error}
            </div>
          ) : !result ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin text-slate-400" />
            </div>
          ) : total === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={28} />}
              heading={threatModels.length === 0 ? 'No threats saved yet' : 'No threats match your filters'}
              subtext={threatModels.length === 0
                ? 'Run a threat analysis from the diagram view to populate this dashboard.'
                : 'Try adjusting or clearing your filters.'}
              cta={threatModels.length === 0 ? (
                <Button onClick={() => router.push(`/projects/${projectId}`)}>
                  <ArrowLeft size={13} /> Go to diagram
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => handleFiltersChange({ severity: 'ALL', status: 'ALL', stride: 'ALL' })}>
                  Clear filters
                </Button>
              )}
            />
          ) : (
            <>
              <ThreatsTable
                projectId={projectId}
                threats={threats}
                loading={tableLoading}
                onStatusChanged={handleStatusChanged}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0 || tableLoading}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
                            ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-400 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500'
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
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
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
          onCreated={() => { setPage(0); setRefreshKey((k) => k + 1); setShowAddModal(false); }}
        />
      )}
    </div>
  );
}
