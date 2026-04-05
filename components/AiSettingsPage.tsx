'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Settings, Cpu, Zap, BarChart3, Check, AlertCircle, Loader2,
  ChevronDown, Eye, EyeOff, Key, ShieldCheck, Trash2, Terminal,
  ExternalLink, Brain, Gauge, ChevronRight,
} from 'lucide-react';
import {
  apiGetAiSettings, apiUpdateAiSettings, apiGetAiMetrics,
  type UserAiSettings, type UpdateAiSettingsPayload, type AiProvider, type AiTokenMetrics,
} from '@/lib/api';

// ── Model catalog ─────────────────────────────────────────────────────────────

type ReasoningLevel = 'fast' | 'balanced' | 'powerful' | 'reasoning';

interface ModelOption {
  id: string;
  label: string;
  contextWindow: string;
  reasoning: ReasoningLevel;
  description: string;
  badge?: string;
}

const MODEL_CATALOG: Record<AiProvider, ModelOption[]> = {
  ANTHROPIC: [
    {
      id: 'claude-haiku-4-5-20251001',
      label: 'Claude Haiku 4.5',
      contextWindow: '200K',
      reasoning: 'fast',
      description: 'Fastest and most compact. Ideal for quick diagram edits and simple tasks.',
    },
    {
      id: 'claude-sonnet-4-6',
      label: 'Claude Sonnet 4.6',
      contextWindow: '200K',
      reasoning: 'balanced',
      description: 'Best balance of speed and intelligence. Recommended for most workflows.',
      badge: 'Recommended',
    },
    {
      id: 'claude-opus-4-6',
      label: 'Claude Opus 4.6',
      contextWindow: '200K',
      reasoning: 'powerful',
      description: 'Most capable Claude model. Best for complex architecture and threat analysis.',
    },
  ],
  OPENAI: [
    {
      id: 'gpt-4o-mini',
      label: 'GPT-4o mini',
      contextWindow: '128K',
      reasoning: 'fast',
      description: 'Lightweight and cost-effective. Good for straightforward diagram generation.',
    },
    {
      id: 'gpt-4o',
      label: 'GPT-4o',
      contextWindow: '128K',
      reasoning: 'balanced',
      description: 'Flagship multimodal model. Strong at both generation and analysis.',
      badge: 'Recommended',
    },
    {
      id: 'o4-mini',
      label: 'o4-mini',
      contextWindow: '200K',
      reasoning: 'reasoning',
      description: 'Efficient reasoning model. Great for security analysis and threat modeling.',
    },
    {
      id: 'o3',
      label: 'o3',
      contextWindow: '200K',
      reasoning: 'reasoning',
      description: "OpenAI's most powerful reasoning model. For deep security and architecture work.",
    },
  ],
  OLLAMA: [
    {
      id: 'qwen3:8b',
      label: 'Qwen 3 8B',
      contextWindow: '128K',
      reasoning: 'fast',
      description: 'Compact and fast local model. Recommended for most local deployments.',
      badge: 'Recommended',
    },
    {
      id: 'qwen3:14b',
      label: 'Qwen 3 14B',
      contextWindow: '128K',
      reasoning: 'balanced',
      description: 'Better quality with reasonable speed. Good for complex diagram generation.',
    },
    {
      id: 'qwen3:32b',
      label: 'Qwen 3 32B',
      contextWindow: '128K',
      reasoning: 'powerful',
      description: 'High quality local model. Requires significant GPU/RAM (≥24 GB).',
    },
    {
      id: 'llama3.3:70b',
      label: 'Llama 3.3 70B',
      contextWindow: '128K',
      reasoning: 'powerful',
      description: "Meta's large open model. Best local quality, requires ≥48 GB RAM.",
    },
    {
      id: 'gpt-oss:20b',
      label: 'GPT-OSS 20B',
      contextWindow: '128K',
      reasoning: 'balanced',
      description: "Microsoft's open-source GPT model (20B). Strong reasoning, fits in 16 GB VRAM.",
    },
    {
      id: 'gpt-oss:120b',
      label: 'GPT-OSS 120B',
      contextWindow: '128K',
      reasoning: 'powerful',
      description: "Microsoft's open-source GPT model (120B). Near frontier quality. Requires ≥80 GB RAM/VRAM.",
    },
    {
      id: 'mistral:7b',
      label: 'Mistral 7B',
      contextWindow: '32K',
      reasoning: 'fast',
      description: 'Efficient European model. Low resource usage, good instruction following.',
    },
  ],
  REPLICATE: [],
};

const REASONING_META: Record<ReasoningLevel, { label: string; color: string; icon: React.ReactNode }> = {
  fast: {
    label: 'Fast',
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800',
    icon: <Zap size={10} />,
  },
  balanced: {
    label: 'Balanced',
    color: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800',
    icon: <Gauge size={10} />,
  },
  powerful: {
    label: 'Powerful',
    color: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-800',
    icon: <Brain size={10} />,
  },
  reasoning: {
    label: 'Reasoning',
    color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800',
    icon: <Brain size={10} />,
  },
};

// ── Provider config ───────────────────────────────────────────────────────────

interface ProviderInfo {
  id: AiProvider;
  label: string;
  description: string;
  comingSoon?: boolean;
}

const PROVIDERS: ProviderInfo[] = [
  { id: 'ANTHROPIC', label: 'Anthropic', description: 'Claude models — fast, balanced, powerful' },
  { id: 'OPENAI', label: 'OpenAI', description: 'GPT-4o, o3, o4-mini and reasoning models' },
  { id: 'OLLAMA', label: 'Ollama', description: 'Local open-source models — private, no API key' },
  { id: 'REPLICATE', label: 'Replicate', description: 'Cloud-hosted open-source models', comingSoon: true },
];

// ── Token formatting ──────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── ProviderCard ──────────────────────────────────────────────────────────────

function ProviderCard({ info, selected, onSelect }: { info: ProviderInfo; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      disabled={info.comingSoon}
      className={`relative flex w-full flex-col gap-0.5 rounded-xl border px-4 py-3 text-left transition-all ${
        info.comingSoon
          ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-50 dark:border-slate-700 dark:bg-slate-800/40'
          : selected
          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-950/30'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[13px] font-semibold ${selected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>
          {info.label}
        </span>
        {info.comingSoon && (
          <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
            Soon
          </span>
        )}
        {selected && !info.comingSoon && <Check size={13} className="ml-auto text-blue-600 dark:text-blue-400" />}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{info.description}</p>
    </button>
  );
}

// ── ModelPicker ───────────────────────────────────────────────────────────────

function ModelPicker({
  provider,
  value,
  onChange,
}: {
  provider: AiProvider;
  value: string;
  onChange: (v: string) => void;
}) {
  const catalog = MODEL_CATALOG[provider] ?? [];
  const isCustom = value !== '' && !catalog.some((m) => m.id === value);
  const [showCustom, setShowCustom] = useState(isCustom);

  const handleSelect = (id: string) => {
    onChange(id);
    setShowCustom(false);
  };

  const selectedMeta = catalog.find((m) => m.id === value);
  const reasoningMeta = selectedMeta ? REASONING_META[selectedMeta.reasoning] : null;

  return (
    <div className="space-y-2">
      {/* Curated model list */}
      <div className="space-y-1.5">
        {catalog.map((m) => {
          const rm = REASONING_META[m.reasoning];
          const isSelected = value === m.id && !showCustom;
          return (
            <button
              key={m.id}
              onClick={() => handleSelect(m.id)}
              className={`relative flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-950/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
              }`}
            >
              <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 border-current transition-colors" style={{ borderColor: isSelected ? '#3b82f6' : '#94a3b8' }}>
                {isSelected && <div className="h-2 w-2 rounded-full bg-blue-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-[13px] font-semibold ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-100'}`}>
                    {m.label}
                  </span>
                  <span className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${rm.color}`}>
                    {rm.icon}
                    {rm.label}
                  </span>
                  {m.badge && (
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400">
                      {m.badge}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">{m.contextWindow} ctx</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{m.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom model entry */}
      <button
        onClick={() => { setShowCustom(true); if (!showCustom) onChange(''); }}
        className={`flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-left transition-all ${
          showCustom
            ? 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800'
            : 'border-dashed border-slate-300 bg-white hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500'
        }`}
      >
        <ChevronRight size={12} className={`flex-shrink-0 text-slate-400 transition-transform ${showCustom ? 'rotate-90' : ''}`} />
        <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">Enter model name manually</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">(for latest or custom models)</span>
      </button>
      {showCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={provider === 'ANTHROPIC' ? 'e.g. claude-sonnet-4-6' : provider === 'OPENAI' ? 'e.g. gpt-4o' : 'e.g. qwen3:8b'}
          autoFocus
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
        />
      )}

      {/* Reasoning badge for selected model */}
      {reasoningMeta && !showCustom && (
        <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium ${reasoningMeta.color}`}>
          {reasoningMeta.icon}
          <span>Reasoning quality: <strong>{reasoningMeta.label}</strong></span>
          <span className="font-normal opacity-70">
            — {selectedMeta?.description}
          </span>
        </div>
      )}
    </div>
  );
}

// ── OllamaBanner ──────────────────────────────────────────────────────────────

function OllamaBanner({ model }: { model: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-amber-600 dark:text-amber-400" />
          <span className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">Ollama setup required</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200">
          <Check size={13} />
        </button>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
        Ollama runs models locally — no API key needed. Follow these steps to get started:
      </p>
      <ol className="mb-3 space-y-2 text-[12px] text-amber-800 dark:text-amber-300">
        <li className="flex items-start gap-2">
          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">1</span>
          <span>
            Download and install Ollama from{' '}
            <a href="https://ollama.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline hover:no-underline">
              ollama.com <ExternalLink size={10} />
            </a>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">2</span>
          <span>
            Pull your chosen model:{' '}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              ollama pull {model || 'qwen3:8b'}
            </code>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">3</span>
          <span>
            Start the Ollama server:{' '}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              ollama serve
            </code>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-700 dark:bg-amber-900 dark:text-amber-300">4</span>
          <span>Set the base URL below (default: <code className="font-mono text-[11px]">http://localhost:11434</code>)</span>
        </li>
      </ol>
      <p className="text-[11px] text-amber-600 dark:text-amber-500">
        The Drafter backend must be able to reach the Ollama server. If running in Docker, use <code className="font-mono text-[11px]">http://host.docker.internal:11434</code>.
      </p>
    </div>
  );
}

// ── MetricsTable ──────────────────────────────────────────────────────────────

function MetricsTable({ metrics }: { metrics: AiTokenMetrics }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-6 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Total tokens</span>
          <span className="text-[22px] font-bold text-slate-900 dark:text-slate-100">{fmtTokens(metrics.totalTokens)}</span>
        </div>
        <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Input</span>
          <span className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{fmtTokens(metrics.totalInputTokens)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Output</span>
          <span className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{fmtTokens(metrics.totalOutputTokens)}</span>
        </div>
      </div>
      {metrics.byModel.length > 0 ? (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
              <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Provider</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Model</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Calls</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Input</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Output</th>
              <th className="px-4 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {metrics.byModel.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-2 capitalize text-slate-700 dark:text-slate-300">{row.provider}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">{row.model}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{row.calls}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmtTokens(row.inputTokens)}</td>
                <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-400">{fmtTokens(row.outputTokens)}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800 dark:text-slate-200">{fmtTokens(row.inputTokens + row.outputTokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="px-4 py-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
          No token usage yet — token data is recorded for new AI calls after this update.
        </div>
      )}
    </div>
  );
}

// ── ApiKeyInput ───────────────────────────────────────────────────────────────

interface ApiKeyInputProps {
  label: string;
  keySet: boolean;
  maskedValue: string | null;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  placeholder: string;
}

function ApiKeyInput({ label, keySet, maskedValue, value, onChange, onClear, placeholder }: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(!keySet);

  const handleStartChange = () => { setEditing(true); onChange(''); };
  const handleClear = () => { onClear(); setEditing(true); };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <Key size={13} className="text-slate-400 dark:text-slate-500" />
        <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        {keySet && !editing && (
          <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
            <ShieldCheck size={9} />
            Encrypted
          </span>
        )}
      </div>
      {keySet && !editing ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
            {maskedValue ?? '••••••••••••'}
          </code>
          <button onClick={handleStartChange} className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
            Change
          </button>
          <button onClick={handleClear} title="Remove key" className="rounded-lg border border-red-200 px-2 py-2 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30">
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 pr-10 font-mono text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button type="button" onClick={() => setVisible((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" tabIndex={-1}>
            {visible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      )}
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
        <ShieldCheck size={10} />
        Transmitted over HTTPS · Stored as AES-256-GCM encrypted ciphertext · Never logged
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<UserAiSettings | null>(null);
  const [metrics, setMetrics] = useState<AiTokenMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState<AiProvider>('ANTHROPIC');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [maxOutputTokens, setMaxOutputTokens] = useState<string>('');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('');
  const [openAiBaseUrl, setOpenAiBaseUrl] = useState('');
  const [metricsOpen, setMetricsOpen] = useState(true);

  const [anthropicKey, setAnthropicKey] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [clearAnthropicKey, setClearAnthropicKey] = useState(false);
  const [clearOpenAiKey, setClearOpenAiKey] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([apiGetAiSettings(), apiGetAiMetrics()]);
      setSettings(s);
      setMetrics(m);
      setProvider(s.provider);
      setModel(s.model);
      setMaxOutputTokens(s.maxOutputTokens ? String(s.maxOutputTokens) : '');
      setOllamaBaseUrl(s.ollamaBaseUrl ?? '');
      setOpenAiBaseUrl(s.openAiBaseUrl ?? '');
      setAnthropicKey('');
      setOpenAiKey('');
      setClearAnthropicKey(false);
      setClearOpenAiKey(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleProviderChange = (p: AiProvider) => {
    setProvider(p);
    // Auto-select first recommended model for the new provider
    const first = MODEL_CATALOG[p]?.[0];
    if (first) setModel(first.id);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: UpdateAiSettingsPayload = {
        provider,
        model: model.trim() || undefined,
        maxOutputTokens: maxOutputTokens ? parseInt(maxOutputTokens, 10) : undefined,
        ollamaBaseUrl: ollamaBaseUrl.trim() || null,
        openAiBaseUrl: openAiBaseUrl.trim() || null,
      };
      if (clearAnthropicKey) payload.anthropicApiKey = '';
      else if (anthropicKey) payload.anthropicApiKey = anthropicKey;
      if (clearOpenAiKey) payload.openAiApiKey = '';
      else if (openAiKey) payload.openAiApiKey = openAiKey;

      const updated = await apiUpdateAiSettings(payload);
      setSettings(updated);
      setAnthropicKey('');
      setOpenAiKey('');
      setClearAnthropicKey(false);
      setClearOpenAiKey(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      apiGetAiMetrics().then(setMetrics).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={22} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Settings size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-slate-900 dark:text-slate-100">AI Settings</h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              Configure the AI provider and model used for diagram generation and analysis
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Ollama setup banner */}
        {provider === 'OLLAMA' && <OllamaBanner model={model} />}

        {/* Provider */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Cpu size={14} className="text-slate-500 dark:text-slate-400" />
            <h2 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">AI Provider</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => (
              <ProviderCard key={p.id} info={p} selected={provider === p.id} onSelect={() => handleProviderChange(p.id)} />
            ))}
          </div>
        </section>

        {/* Model picker */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Brain size={14} className="text-slate-500 dark:text-slate-400" />
            <h2 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Model</h2>
          </div>
          <ModelPicker provider={provider} value={model} onChange={setModel} />
        </section>

        {/* API key — Anthropic */}
        {provider === 'ANTHROPIC' && (
          <section className="mb-6">
            <ApiKeyInput
              label="Anthropic API key"
              keySet={settings?.anthropicKeySet ?? false}
              maskedValue={settings?.anthropicKeyMasked ?? null}
              value={anthropicKey}
              onChange={(v) => { setAnthropicKey(v); setClearAnthropicKey(false); }}
              onClear={() => { setAnthropicKey(''); setClearAnthropicKey(true); }}
              placeholder="sk-ant-api03-…"
            />
          </section>
        )}

        {/* API key — OpenAI */}
        {provider === 'OPENAI' && (
          <section className="mb-6">
            <ApiKeyInput
              label="OpenAI API key"
              keySet={settings?.openAiKeySet ?? false}
              maskedValue={settings?.openAiKeyMasked ?? null}
              value={openAiKey}
              onChange={(v) => { setOpenAiKey(v); setClearOpenAiKey(false); }}
              onClear={() => { setOpenAiKey(''); setClearOpenAiKey(true); }}
              placeholder="sk-proj-…"
            />
          </section>
        )}

        {/* Ollama base URL */}
        {provider === 'OLLAMA' && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              Ollama base URL
            </label>
            <input
              type="text"
              value={ollamaBaseUrl}
              onChange={(e) => setOllamaBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              Default: <code className="font-mono">http://localhost:11434</code>. In Docker use <code className="font-mono">http://host.docker.internal:11434</code>.
            </p>
          </section>
        )}

        {/* OpenAI custom base URL */}
        {provider === 'OPENAI' && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              Custom API base URL <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={openAiBaseUrl}
              onChange={(e) => setOpenAiBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              Use for OpenAI-compatible providers (Azure, Together AI, LM Studio, etc.)
            </p>
          </section>
        )}

        {/* Max output tokens */}
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <label className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">
            Max output tokens <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="number"
            value={maxOutputTokens}
            onChange={(e) => setMaxOutputTokens(e.target.value)}
            placeholder="Default: 4096"
            min={256}
            max={32000}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            Limit how many tokens the model can generate per response. Range: 256 – 32,000.
          </p>
        </section>

        {/* Save */}
        <div className="mb-10 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Zap size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
              <Check size={12} />
              Settings applied to all future AI calls
            </span>
          )}
        </div>

        {/* Token metrics */}
        <section>
          <button onClick={() => setMetricsOpen((v) => !v)} className="mb-3 flex w-full items-center gap-2 text-left">
            <BarChart3 size={14} className="text-slate-500 dark:text-slate-400" />
            <h2 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Token usage</h2>
            <ChevronDown size={13} className={`ml-auto text-slate-400 transition-transform ${metricsOpen ? 'rotate-180' : ''}`} />
          </button>
          {metricsOpen && metrics && <MetricsTable metrics={metrics} />}
          {metricsOpen && !metrics && (
            <div className="rounded-xl border border-slate-200 px-4 py-6 text-center text-[13px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
              Could not load metrics
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            Token counts are recorded for AI calls made through the Drafter backend. Older chat messages do not have token data.
          </p>
        </section>
      </div>
    </div>
  );
}
