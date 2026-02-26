'use client';

import { useState } from 'react';
import { X, Loader2, Share2 } from 'lucide-react';
import { apiLogin, apiRegister, apiGetMe, type UserProfile } from '@/lib/api';
import { saveTokens, saveUser } from '@/lib/authStore';

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
  onClose: () => void;
}

type Tab = 'login' | 'register';

export default function AuthModal({ onSuccess, onClose }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const tokens =
        tab === 'login'
          ? await apiLogin(email.trim(), password)
          : await apiRegister(email.trim(), password, name.trim() || undefined);
      saveTokens(tokens.accessToken, tokens.refreshToken);
      const user = await apiGetMe();
      saveUser(user);
      onSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Share2 size={16} className="text-blue-600" />
              <span className="text-sm font-bold text-slate-800">Drafter</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {tab === 'login' ? 'Sign in to your account' : 'Create an account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mb-5 flex rounded-xl border border-slate-200 p-1">
          <button
            onClick={() => { setTab('login'); setError(null); }}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
              tab === 'login'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => { setTab('register'); setError(null); }}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
              tab === 'register'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {tab === 'register' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Name <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !email.trim() || !password.trim()}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
