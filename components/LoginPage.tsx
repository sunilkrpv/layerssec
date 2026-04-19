'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, BarChart2, FileText, ArrowRight, Zap, Clock, Mail } from 'lucide-react';
import LayersLogo from '@/components/LayersLogo';
import { apiLogin, apiRegister, apiGetMe } from '@/lib/api';
import { saveTokens, saveUser, isLoggedIn } from '@/lib/authStore';

// ── Animated DFD illustration ──────────────────────────────────────────────────
function DiagramIllustration() {
  return (
    <>
      <style>{`
        .ef      { animation: ef 2s linear infinite; }
        .ef-slow { animation: ef 3.2s linear infinite; }
        @keyframes ef { to { stroke-dashoffset: -24; } }

        .pr       { animation: pr 2.8s ease-out infinite; }
        .pr-delay { animation: pr 2.8s ease-out 1.4s infinite; }
        @keyframes pr {
          0%   { r: 5;  opacity: 0.4; }
          100% { r: 16; opacity: 0; }
        }

        .scan { animation: scan 4.5s ease-in-out infinite; }
        @keyframes scan {
          0%   { transform: translateY(0);     opacity: 0; }
          6%   { opacity: 0.5; }
          94%  { opacity: 0.5; }
          100% { transform: translateY(180px); opacity: 0; }
        }

        .dot-pulse { animation: dot-pulse 1.5s ease-in-out infinite; }
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
      `}</style>

      <svg viewBox="0 0 480 186" fill="none" className="w-full" aria-hidden>
        {/* Pulse rings */}
        <circle cx="202" cy="50" r="5" fill="none" stroke="rgba(239,68,68,0.25)" className="pr" />
        <circle cx="352" cy="50" r="5" fill="none" stroke="rgba(139,92,246,0.25)" className="pr-delay" />

        {/* Scan line */}
        <rect x="0" y="0" width="480" height="3" rx="1" fill="rgba(96,165,250,0.12)" className="scan" />

        {/* Edges */}
        <path d="M100 50 L148 50" stroke="rgba(147,197,253,0.45)" strokeWidth="1.2" strokeDasharray="5 3" className="ef" />
        <path d="M256 50 L300 50" stroke="rgba(167,139,250,0.45)" strokeWidth="1.2" strokeDasharray="5 3" className="ef" />
        <path d="M202 62 L202 108" stroke="rgba(147,197,253,0.35)" strokeWidth="1.2" strokeDasharray="5 3" className="ef-slow" />
        <path d="M352 62 L352 108" stroke="rgba(167,139,250,0.35)" strokeWidth="1.2" strokeDasharray="5 3" className="ef-slow" />
        <path d="M256 120 L300 120" stroke="rgba(52,211,153,0.4)" strokeWidth="1.2" strokeDasharray="5 3" className="ef" />
        <path d="M148 120 L100 120" stroke="rgba(147,197,253,0.35)" strokeWidth="1.2" strokeDasharray="5 3" className="ef-slow" />

        {/* Arrowheads */}
        <polygon points="146,47 150,50 146,53" fill="rgba(147,197,253,0.6)" />
        <polygon points="298,47 302,50 298,53" fill="rgba(167,139,250,0.6)" />
        <polygon points="199,106 202,110 205,106" fill="rgba(147,197,253,0.6)" />
        <polygon points="349,106 352,110 355,106" fill="rgba(167,139,250,0.6)" />
        <polygon points="298,117 302,120 298,123" fill="rgba(52,211,153,0.6)" />
        <polygon points="102,117 98,120 102,123" fill="rgba(147,197,253,0.6)" />

        {/* Nodes */}
        <rect x="20" y="38" width="80" height="24" rx="5" fill="rgba(96,165,250,0.1)" stroke="rgba(147,197,253,0.4)" strokeWidth="1" />
        <text x="60" y="54" textAnchor="middle" fill="rgba(219,234,254,0.75)" fontSize="6" fontFamily="system-ui,sans-serif">Client</text>

        <rect x="148" y="38" width="108" height="24" rx="5" fill="rgba(99,102,241,0.2)" stroke="rgba(167,139,250,0.6)" strokeWidth="1" />
        <text x="202" y="54" textAnchor="middle" fill="rgba(224,231,255,0.9)" fontSize="6" fontFamily="system-ui,sans-serif" fontWeight="600">API Gateway</text>

        <rect x="300" y="38" width="104" height="24" rx="5" fill="rgba(139,92,246,0.15)" stroke="rgba(167,139,250,0.45)" strokeWidth="1" />
        <text x="352" y="54" textAnchor="middle" fill="rgba(221,214,254,0.75)" fontSize="6" fontFamily="system-ui,sans-serif">Auth Service</text>

        <rect x="20" y="108" width="80" height="24" rx="5" fill="rgba(251,191,36,0.08)" stroke="rgba(253,224,71,0.3)" strokeWidth="1" />
        <text x="60" y="124" textAnchor="middle" fill="rgba(254,249,195,0.7)" fontSize="6" fontFamily="system-ui,sans-serif">Cache</text>

        <rect x="148" y="108" width="108" height="24" rx="5" fill="rgba(96,165,250,0.1)" stroke="rgba(147,197,253,0.4)" strokeWidth="1" />
        <text x="202" y="124" textAnchor="middle" fill="rgba(219,234,254,0.75)" fontSize="6" fontFamily="system-ui,sans-serif">Microservice</text>

        <rect x="300" y="108" width="104" height="24" rx="5" fill="rgba(52,211,153,0.1)" stroke="rgba(110,231,183,0.4)" strokeWidth="1" />
        <text x="352" y="124" textAnchor="middle" fill="rgba(209,250,229,0.75)" fontSize="6" fontFamily="system-ui,sans-serif">Database</text>

        {/* AI analysis bar */}
        <rect x="16" y="150" width="448" height="28" rx="7" fill="rgba(10,8,40,0.55)" stroke="rgba(99,102,241,0.2)" strokeWidth="1" />
        <circle cx="30" cy="164" r="3.5" fill="rgba(99,102,241,0.9)" className="dot-pulse" />
        <text x="42" y="161" fill="rgba(199,210,254,0.9)" fontSize="7.5" fontWeight="600" fontFamily="system-ui,sans-serif">AI Threat Analysis</text>
        <text x="42" y="172" fill="rgba(165,180,252,0.45)" fontSize="7" fontFamily="system-ui,sans-serif">14 threats · 6 nodes</text>
        <text x="224" y="160" fill="rgba(252,165,165,0.85)" fontSize="7.5" fontWeight="700" fontFamily="system-ui,sans-serif">3 Critical</text>
        <text x="224" y="171" fill="rgba(253,186,116,0.7)" fontSize="7" fontFamily="system-ui,sans-serif">5 High · 6 Medium</text>
        <text x="456" y="159" textAnchor="end" fill="rgba(165,180,252,0.4)" fontSize="7" fontFamily="system-ui,sans-serif">Posture</text>
        <text x="456" y="171" textAnchor="end" fill="rgba(252,165,165,0.8)" fontSize="10" fontWeight="800" fontFamily="system-ui,sans-serif">62/100</text>
      </svg>
    </>
  );
}

// ── Three key capabilities (horizontal, minimal) ───────────────────────────────
const CAPABILITIES = [
  {
    icon: Shield,
    label: 'STRIDE Threat Modeling',
    desc: 'AI-powered per-node threat analysis across all 6 STRIDE categories',
  },
  {
    icon: BarChart2,
    label: 'Security Posture Scoring',
    desc: 'Continuous 0–100 posture score with prioritized remediation steps',
  },
  {
    icon: FileText,
    label: 'Audit-Ready Reports',
    desc: 'Export professional PDF threat models for security reviews and compliance',
  },
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allowRegister, setAllowRegister] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace('/home');
    }
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isDev =
        process.env.NODE_ENV === 'development' ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.local');
      setAllowRegister(isDev);
    }
  }, [router]);

  const switchTab = (t: 'login' | 'register') => {
    setTab(t);
    setError(null);
  };

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const tokens = await apiLogin(email, password);
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

  const handleRegister = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const tokens = await apiRegister(email, password, name || undefined);
      saveTokens(tokens.accessToken, tokens.refreshToken);
      const user = await apiGetMe();
      saveUser(user);
      router.push('/home');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Left hero panel ──────────────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[55%] flex-col justify-between bg-[#080c18] p-10">

        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-indigo-600/8 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/6 blur-3xl" />
        </div>

        {/* Top: Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/8 ring-1 ring-white/12">
            <LayersLogo size={16} className="text-blue-400" />
          </div>
          <span className="text-base font-semibold tracking-tight text-white/90">Layers</span>
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
            Alpha
          </span>
        </div>

        {/* Middle: Headline + diagram */}
        <div className="relative space-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400/70">
              For security engineers &amp; engineering managers
            </p>
            <h1 className="text-[2.25rem] font-bold leading-[1.15] tracking-tight text-white">
              Design. Threat Model.
              <br />
              <span className="text-blue-400">Simulate Exploits.</span>
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-white/40">
              AI powered STRIDE analysis, posture scoring, attack path simulation
              and reports - in one canvas.
            </p>
          </div>

          <DiagramIllustration />
        </div>

        {/* Bottom: 3 capabilities - horizontal, minimal */}
        <div className="relative space-y-3">
          {CAPABILITIES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white/6 ring-1 ring-white/10">
                <Icon size={13} className="text-indigo-300" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/75">{label}</p>
                <p className="text-[11px] leading-snug text-white/35">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-[340px]">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <LayersLogo size={20} className="text-blue-600" />
            <span className="text-lg font-bold text-slate-800">Layers</span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            {tab === 'login' ? (
              <>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Sign in to Layers
                </h2>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-400">
                  Continue your threat models, posture scores and security reports.
                </p>
              </>
            ) : allowRegister ? (
              <>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Create your account
                </h2>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-400">
                  Start building threat models in seconds.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Self-serve coming soon
                </h2>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-400">
                  We're rolling out access gradually. Request early access below.
                </p>
              </>
            )}
          </div>

          {/* Tab switcher */}
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

          {/* Form / Coming Soon */}
          {tab === 'register' && allowRegister ? (
            <>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Name <span className="text-slate-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Work email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Sign In
                </button>
              </p>
            </>
          ) : tab === 'register' ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-6 py-8 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100">
                  <Clock size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Waitlist open</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Self-serve sign-up is coming soon. Drop us an email and we'll get you set up.
                  </p>
                </div>
                <a
                  href="mailto:hi@layerssec.com?subject=Early access request"
                  className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  <Mail size={14} />
                  Request early access
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
              <p className="text-center text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Sign In
                </button>
              </p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Work email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-300 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-slate-400">
                {"Don't have an account? "}
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  Register
                </button>
              </p>
            </>
          )}

          {/* Social proof / trust signal */}
          <div className="mt-8 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <Zap size={12} className="flex-shrink-0 text-indigo-500" />
            <p className="text-[11px] leading-snug text-slate-400">
              <span className="font-medium text-slate-600">AI-powered threat modeling.</span>{' '}
              STRIDE · Posture scoring · Attack simulation · PDF reports
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
