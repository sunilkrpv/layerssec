'use client';

import { useState } from 'react';
import { X, ShieldCheck, Loader2, Plus } from 'lucide-react';
import {
  apiCreateThreat,
  type ThreatModelSummary, type ThreatSeverity, type StrideCategory, type ThreatItem,
  type ProjectThreat,
} from '@/lib/api';
import { SEVERITY_OPTIONS, STRIDE_OPTIONS, STRIDE_LABEL } from '@/lib/threatBadges';

export interface AddThreatModalProps {
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

export function AddThreatModal({ projectId, models, onClose, onCreated }: AddThreatModalProps) {
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
