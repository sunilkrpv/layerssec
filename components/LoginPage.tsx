'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, GitBranch, Shield, FileText,
  ArrowRight, Sword, BarChart2,
} from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { apiLogin, apiRegister, apiGetMe } from '@/lib/api';
import { saveTokens, saveUser, isLoggedIn } from '@/lib/authStore';

// ── STRIDE-annotated animated diagram illustration ────────────────────────────
function DiagramIllustration() {
  return (
    <>
      <style>{`
        .edge-flow      { animation: edge-flow 2s linear infinite; }
        .edge-flow-slow { animation: edge-flow 3.2s linear infinite; }
        @keyframes edge-flow { to { stroke-dashoffset: -24; } }

        .pulse-ring       { animation: pulse-ring 2.8s ease-out infinite; }
        .pulse-ring-delay { animation: pulse-ring 2.8s ease-out 1.4s infinite; }
        @keyframes pulse-ring {
          0%   { r: 5;  opacity: 0.5; }
          100% { r: 18; opacity: 0; }
        }

        .ai-scan-line { animation: ai-scan 4.5s ease-in-out infinite; }
        @keyframes ai-scan {
          0%   { transform: translateY(0px);   opacity: 0; }
          6%   { opacity: 0.6; }
          94%  { opacity: 0.6; }
          100% { transform: translateY(190px); opacity: 0; }
        }

        .ai-dot { animation: ai-dot-pulse 1.5s ease-in-out infinite; }
        @keyframes ai-dot-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
      `}</style>

      <svg viewBox="0 0 480 186" fill="none" className="w-full" aria-hidden>
        {/* ── Pulse rings (high-risk nodes) ──────────────────────────── */}
        <circle cx="202" cy="50" r="5" fill="none" stroke="rgba(239,68,68,0.3)" className="pulse-ring" />
        <circle cx="352" cy="50" r="5" fill="none" stroke="rgba(139,92,246,0.3)" className="pulse-ring-delay" />

        {/* ── AI scan line ────────────────────────────────────────────── */}
        <rect x="0" y="0" width="480" height="4" rx="1" fill="rgba(96,165,250,0.15)" className="ai-scan-line" />

        {/* ── Edges ───────────────────────────────────────────────────── */}
        {/* Client → API Gateway */}
        <path d="M100 50 L148 50" stroke="rgba(147,197,253,0.55)" strokeWidth="1.5" strokeDasharray="5 3" className="edge-flow" />
        {/* API Gateway → Auth Service */}
        <path d="M256 50 L300 50" stroke="rgba(167,139,250,0.55)" strokeWidth="1.5" strokeDasharray="5 3" className="edge-flow" />
        {/* API Gateway → Microservice */}
        <path d="M202 62 L202 108" stroke="rgba(147,197,253,0.45)" strokeWidth="1.5" strokeDasharray="5 3" className="edge-flow-slow" />
        {/* Auth Service → Database */}
        <path d="M352 62 L352 108" stroke="rgba(167,139,250,0.4)" strokeWidth="1.5" strokeDasharray="5 3" className="edge-flow-slow" />
        {/* Microservice → Database */}
        <path d="M256 120 L300 120" stroke="rgba(52,211,153,0.5)" strokeWidth="1.5" strokeDasharray="5 3" className="edge-flow" />
        {/* Microservice → Cache (reversed) */}
        <path d="M148 120 L100 120" stroke="rgba(147,197,253,0.4)" strokeWidth="1.5" strokeDasharray="5 3" className="edge-flow-slow" />

        {/* Arrowheads */}
        <polygon points="146,47 150,50 146,53" fill="rgba(147,197,253,0.7)" />
        <polygon points="298,47 302,50 298,53" fill="rgba(167,139,250,0.7)" />
        <polygon points="199,106 202,110 205,106" fill="rgba(147,197,253,0.7)" />
        <polygon points="349,106 352,110 355,106" fill="rgba(167,139,250,0.7)" />
        <polygon points="298,117 302,120 298,123" fill="rgba(52,211,153,0.7)" />
        <polygon points="102,117 98,120 102,123" fill="rgba(147,197,253,0.7)" />

        {/* ── Nodes ───────────────────────────────────────────────────── */}
        {/* Client */}
        <rect x="20" y="38" width="80" height="24" rx="5"
          fill="rgba(96,165,250,0.12)" stroke="rgba(147,197,253,0.5)" strokeWidth="1.2" />
        <text x="60" y="54" textAnchor="middle" fill="rgba(219,234,254,0.85)"
          fontSize="6" fontFamily="system-ui,sans-serif">Client</text>

        {/* API Gateway */}
        <rect x="148" y="38" width="108" height="24" rx="5"
          fill="rgba(99,102,241,0.25)" stroke="rgba(167,139,250,0.7)" strokeWidth="1.2" />
        <text x="202" y="54" textAnchor="middle" fill="rgba(224,231,255,0.95)"
          fontSize="6" fontFamily="system-ui,sans-serif" fontWeight="600">API Gateway</text>

        {/* Auth Service */}
        <rect x="300" y="38" width="104" height="24" rx="5"
          fill="rgba(139,92,246,0.18)" stroke="rgba(167,139,250,0.55)" strokeWidth="1.2" />
        <text x="352" y="54" textAnchor="middle" fill="rgba(221,214,254,0.85)"
          fontSize="6" fontFamily="system-ui,sans-serif">Auth Service</text>

        {/* Cache */}
        <rect x="20" y="108" width="80" height="24" rx="5"
          fill="rgba(251,191,36,0.1)" stroke="rgba(253,224,71,0.38)" strokeWidth="1.2" />
        <text x="60" y="124" textAnchor="middle" fill="rgba(254,249,195,0.8)"
          fontSize="6" fontFamily="system-ui,sans-serif">Cache</text>

        {/* Microservice */}
        <rect x="148" y="108" width="108" height="24" rx="5"
          fill="rgba(96,165,250,0.12)" stroke="rgba(147,197,253,0.5)" strokeWidth="1.2" />
        <text x="202" y="124" textAnchor="middle" fill="rgba(219,234,254,0.85)"
          fontSize="6" fontFamily="system-ui,sans-serif">Microservice</text>

        {/* Database */}
        <rect x="300" y="108" width="104" height="24" rx="5"
          fill="rgba(52,211,153,0.12)" stroke="rgba(110,231,183,0.5)" strokeWidth="1.2" />
        <text x="352" y="124" textAnchor="middle" fill="rgba(209,250,229,0.85)"
          fontSize="6" fontFamily="system-ui,sans-serif">Database</text>

        {/* ── AI analysis status bar ───────────────────────────────────── */}
        <rect x="16" y="148" width="448" height="28" rx="7"
          fill="rgba(15,10,50,0.5)" stroke="rgba(99,102,241,0.28)" strokeWidth="1" />

        <circle cx="30" cy="162" r="3.5" fill="rgba(99,102,241,0.9)" className="ai-dot" />

        <text x="42" y="159" fill="rgba(199,210,254,0.9)" fontSize="7.5" fontWeight="600"
          fontFamily="system-ui,sans-serif">AI Threat Analysis</text>
        <text x="42" y="170" fill="rgba(165,180,252,0.5)" fontSize="7"
          fontFamily="system-ui,sans-serif">14 threats · 6 nodes</text>

        <text x="220" y="158" fill="rgba(252,165,165,0.9)" fontSize="7.5" fontWeight="700"
          fontFamily="system-ui,sans-serif">3 Critical</text>
        <text x="220" y="169" fill="rgba(253,186,116,0.8)" fontSize="7"
          fontFamily="system-ui,sans-serif">5 High · 6 Medium</text>

        <text x="456" y="157" textAnchor="end" fill="rgba(165,180,252,0.45)" fontSize="7"
          fontFamily="system-ui,sans-serif">Posture</text>
        <text x="456" y="170" textAnchor="end" fill="rgba(252,165,165,0.85)" fontSize="10"
          fontWeight="800" fontFamily="system-ui,sans-serif">62/100</text>
      </svg>
    </>
  );
}

// ── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Sparkles,
    label: 'AI Architecture Generation',
    desc: 'Generate full diagrams from plain-text system descriptions',
    accent: 'bg-blue-500/20 ring-blue-400/30 text-blue-300',
  },
  {
    icon: Shield,
    label: 'STRIDE Threat Modeling',
    desc: 'Auto-identify threats across all 6 STRIDE categories per node',
    accent: 'bg-red-500/20 ring-red-400/30 text-red-300',
  },
  {
    icon: Sword,
    label: 'Attack Simulation',
    desc: 'Simulate red-team attack paths and exploit chains',
    accent: 'bg-orange-500/20 ring-orange-400/30 text-orange-300',
  },
  {
    icon: BarChart2,
    label: 'Security Posture Score',
    desc: 'AI-computed 0–100 health score with remediation steps',
    accent: 'bg-emerald-500/20 ring-emerald-400/30 text-emerald-300',
  },
  {
    icon: GitBranch,
    label: 'Version Control & Diff',
    desc: 'Publish, compare, and track architecture changes over time',
    accent: 'bg-indigo-500/20 ring-indigo-400/30 text-indigo-300',
  },
  {
    icon: FileText,
    label: 'Threat Reports',
    desc: 'Export professional PDF reports for auditors and stakeholders',
    accent: 'bg-violet-500/20 ring-violet-400/30 text-violet-300',
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace('/home');
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
      router.push('/home');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Left hero panel ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between bg-gradient-to-br from-indigo-950 via-indigo-900 to-blue-900 p-10 relative overflow-hidden">

        {/* Background mesh */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        {/* Top: Logo + eyebrow */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
              <LayersLogo size={20} className="text-blue-300" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Layers</span>
            <span className="ml-1 rounded-full border border-indigo-400/40 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-300">
              ALPHA
            </span>
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-indigo-400">
            AI-Powered Security-first architecture threat modeling, Posture scoring &amp; Attack Simulation
          </p>
        </div>

        {/* Middle: Headline + subtext + diagram */}
        <div className="relative space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white">
              Design.{' '}
              <span className="bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                Threat Model.
              </span>
              <br />
              Simulate Exploits.
            </h1>
            <p className="text-[13px] leading-relaxed text-indigo-200/70">
              Generate architecture with AI, run STRIDE threat analysis, simulate attacks
              and score your security posture — all in one canvas.
            </p>
          </div>

          <DiagramIllustration />
        </div>

        {/* Bottom: 6-feature grid (3×2) */}
        <div className="relative grid grid-cols-3 gap-2">
          {FEATURES.map(({ icon: Icon, label, desc, accent }) => (
            <div
              key={label}
              className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ring-1 ${accent}`}>
                  <Icon size={12} />
                </div>
                <p className="text-[11px] font-semibold leading-tight text-white">{label}</p>
              </div>
              <p className="text-[10px] leading-snug text-indigo-200/80">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <LayersLogo size={22} className="text-blue-600" />
            <span className="text-xl font-bold text-slate-800">Layers</span>
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
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              {tab === 'login' ? 'Register' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
