'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  Sparkles,
  GitBranch,
  Share2,
  Download,
  ArrowRight,
} from 'lucide-react';
import { apiLogin, apiRegister, apiGetMe } from '@/lib/api';
import { saveTokens, saveUser, isLoggedIn, setLocalMode } from '@/lib/authStore';

// ── Decorative diagram illustration (SVG) ────────────────────────────────────
function DiagramIllustration() {
  return (
    <svg viewBox="0 0 320 220" fill="none" className="w-full max-w-xs opacity-80" aria-hidden>
      {/* Edges */}
      <path d="M90 70 L160 70" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M160 70 L230 70" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" />
      <path d="M160 70 L160 130" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" />
      <path d="M90 130 L160 130" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M160 130 L230 130" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" />
      <path d="M230 70 L230 130" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d="M160 130 L160 190" stroke="rgba(147,197,253,0.4)" strokeWidth="1.5" />
      {/* Arrowheads */}
      <polygon points="228,68 232,71 228,74" fill="rgba(147,197,253,0.8)" />
      <polygon points="228,128 232,131 228,134" fill="rgba(147,197,253,0.8)" />
      <polygon points="158,128 161,132 164,128" fill="rgba(147,197,253,0.8)" />
      <polygon points="158,188 161,192 164,188" fill="rgba(147,197,253,0.8)" />

      {/* Nodes */}
      {/* Client */}
      <rect x="44" y="54" width="68" height="32" rx="6" fill="rgba(96,165,250,0.15)" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" />
      <text x="78" y="75" textAnchor="middle" fill="rgba(219,234,254,0.9)" fontSize="10" fontFamily="sans-serif">Client</text>

      {/* API Gateway */}
      <rect x="130" y="54" width="84" height="32" rx="6" fill="rgba(99,102,241,0.25)" stroke="rgba(167,139,250,0.7)" strokeWidth="1.5" />
      <text x="172" y="75" textAnchor="middle" fill="rgba(224,231,255,0.95)" fontSize="10" fontFamily="sans-serif" fontWeight="600">API Gateway</text>

      {/* Service A */}
      <rect x="44" y="114" width="68" height="32" rx="6" fill="rgba(96,165,250,0.15)" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" />
      <text x="78" y="135" textAnchor="middle" fill="rgba(219,234,254,0.9)" fontSize="10" fontFamily="sans-serif">Service A</text>

      {/* Service */}
      <rect x="230" y="54" width="68" height="32" rx="6" fill="rgba(96,165,250,0.15)" stroke="rgba(147,197,253,0.6)" strokeWidth="1.5" />
      <text x="264" y="75" textAnchor="middle" fill="rgba(219,234,254,0.9)" fontSize="10" fontFamily="sans-serif">Service</text>

      {/* Database */}
      <rect x="230" y="114" width="68" height="32" rx="6" fill="rgba(52,211,153,0.15)" stroke="rgba(110,231,183,0.6)" strokeWidth="1.5" />
      <text x="264" y="135" textAnchor="middle" fill="rgba(209,250,229,0.9)" fontSize="10" fontFamily="sans-serif">Database</text>

      {/* Cache / Queue */}
      <rect x="130" y="174" width="84" height="32" rx="6" fill="rgba(251,191,36,0.1)" stroke="rgba(253,224,71,0.4)" strokeWidth="1.5" />
      <text x="172" y="195" textAnchor="middle" fill="rgba(254,249,195,0.85)" fontSize="10" fontFamily="sans-serif">Message Queue</text>

      {/* AI sparkle */}
      <circle cx="300" cy="40" r="12" fill="rgba(99,102,241,0.3)" stroke="rgba(167,139,250,0.6)" strokeWidth="1" />
      <text x="300" y="45" textAnchor="middle" fill="rgba(224,231,255,0.9)" fontSize="12">✦</text>
    </svg>
  );
}

const FEATURES = [
  { icon: Sparkles, label: 'AI diagram generation', desc: 'Describe your architecture in plain text' },
  { icon: GitBranch, label: 'Layered drill-down', desc: 'Nested views from HLD to LLD' },
  { icon: Share2, label: 'Cloud sync', desc: 'Projects saved and accessible anywhere' },
  { icon: Download, label: 'Export anywhere', desc: 'PNG, JSON, and project bundles' },
];

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, skip login and go straight to the canvas
  useEffect(() => {
    if (isLoggedIn()) {
      router.replace('/projects/local');
    }
  }, [router]);

  const switchTab = (t: 'login' | 'register') => {
    setTab(t);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const tokens =
        tab === 'login'
          ? await apiLogin(email, password)
          : await apiRegister(email, password, name || undefined);
      saveTokens(tokens.accessToken, tokens.refreshToken);
      const user = await apiGetMe();
      saveUser(user);
      router.push('/projects/local');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left hero panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between bg-gradient-to-br from-indigo-950 via-indigo-900 to-blue-900 p-12 relative overflow-hidden">
        {/* Background mesh */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        {/* Top: Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <Layers size={20} className="text-blue-300" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Drafter</span>
          <span className="ml-1 rounded-full border border-indigo-400/40 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
            Beta
          </span>
        </div>

        {/* Middle: Hero copy + diagram */}
        <div className="relative space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              AI-Powered Architecture Tool
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
              Design.{' '}
              <span className="bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                Collaborate.
              </span>
              <br />
              Ship.
            </h1>
            <p className="max-w-xs text-base text-indigo-200/80">
              Describe your high level system.
              <br />
              Claude draws the architecture diagram.
              <br />
              Drill down from HLD to code in layers.
            </p>
          </div>

          <DiagramIllustration />
        </div>

        {/* Bottom: feature list */}
        <div className="relative grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 ring-1 ring-indigo-400/30">
                <Icon size={15} className="text-indigo-300" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="text-[11px] text-indigo-300/70">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo (shown only when left panel is hidden) */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Layers size={22} className="text-blue-600" />
            <span className="text-xl font-bold text-slate-800">Drafter</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {tab === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {tab === 'login'
                ? 'Sign in to access your diagrams'
                : 'Start building architecture diagrams today'}
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {tab === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : (
                <>
                  {tab === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              {tab === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Local mode */}
          <button
            type="button"
            onClick={() => {
              setLocalMode();
              router.push('/projects/local');
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
          >
            Use without login
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Save to local — no cloud backup
          </p>
        </div>
      </div>
    </div>
  );
}
