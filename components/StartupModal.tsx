'use client';

import { FolderOpen, FilePlus, Loader2, LogIn, Cloud } from 'lucide-react';

interface StartupModalProps {
  onOpen: () => Promise<void>;
  onNew: () => Promise<void>;
  onContinue: () => void;
  /** True while a file-picker operation is pending */
  isLoading?: boolean;
  /** Non-null when user has existing diagram data in this session */
  existingLayerCount?: number;
  /** If set, user is logged in — show "My Projects" instead of "Sign in" */
  userEmail?: string | null;
  /** Called when user clicks "Sign in" */
  onSignIn?: () => void;
  /** Called when user clicks "My Projects" */
  onMyProjects?: () => void;
}

export default function StartupModal({
  onOpen,
  onNew,
  onContinue,
  isLoading = false,
  existingLayerCount,
  userEmail,
  onSignIn,
  onMyProjects,
}: StartupModalProps) {
  const hasExisting = (existingLayerCount ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl font-black tracking-tight text-slate-900">Layers</div>
          <p className="text-sm text-slate-500">Security-first architecture threat modeling</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Cloud: My Projects or Sign In */}
          {userEmail ? (
            <button
              onClick={onMyProjects}
              disabled={isLoading}
              className="flex items-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Cloud size={20} className="flex-shrink-0 text-blue-600" />
              <div>
                <div className="text-sm font-semibold text-slate-800">My Projects</div>
                <div className="text-xs text-slate-500 truncate max-w-[200px]">{userEmail}</div>
              </div>
            </button>
          ) : (
            <button
              onClick={onSignIn}
              disabled={isLoading}
              className="flex items-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn size={20} className="flex-shrink-0 text-blue-600" />
              <div>
                <div className="text-sm font-semibold text-slate-800">Sign in</div>
                <div className="text-xs text-slate-500">Load and sync projects from the cloud</div>
              </div>
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Open existing project */}
          <button
            onClick={onOpen}
            disabled={isLoading}
            className="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 size={20} className="flex-shrink-0 animate-spin text-blue-500" />
            ) : (
              <FolderOpen size={20} className="flex-shrink-0 text-blue-500" />
            )}
            <div>
              <div className="text-sm font-semibold text-slate-800">Open project</div>
              <div className="text-xs text-slate-500">Load a .json project file from disk</div>
            </div>
          </button>

          {/* Create new project */}
          <button
            onClick={onNew}
            disabled={isLoading}
            className="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 size={20} className="flex-shrink-0 animate-spin text-emerald-500" />
            ) : (
              <FilePlus size={20} className="flex-shrink-0 text-emerald-500" />
            )}
            <div>
              <div className="text-sm font-semibold text-slate-800">New project</div>
              <div className="text-xs text-slate-500">Choose a save location and start fresh</div>
            </div>
          </button>
        </div>

        {/* Continue / dismiss */}
        <div className="mt-5 text-center">
          <button
            onClick={onContinue}
            disabled={isLoading}
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline disabled:cursor-not-allowed"
          >
            {hasExisting
              ? `Continue with existing data (${existingLayerCount} layer${existingLayerCount !== 1 ? 's' : ''})`
              : 'Continue without saving'}
          </button>
        </div>
      </div>
    </div>
  );
}
