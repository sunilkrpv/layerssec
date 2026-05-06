'use client';

import { AlertCircle, Settings } from 'lucide-react';
import { useOnboarding } from '@/lib/onboardingStore';

interface Props {
  onOpenSettings: () => void;
}

/**
 * Thin amber banner shown at the top of the app shell whenever the user has not
 * yet saved an AI provider. Hidden once a provider is configured. Non-dismissable
 * by design — it's a persistent nudge until resolved.
 */
export default function AiNotConfiguredBanner({ onOpenSettings }: Props) {
  const { state } = useOnboarding();

  if (!state || state.aiConfigured) return null;

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[12px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertCircle size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="flex-1">
        <span className="font-semibold">AI features are disabled.</span>{' '}
        Connect an AI provider (Anthropic, OpenAI, Replicate, or local Ollama) to enable diagram generation, STRIDE analysis, and posture scoring.
      </span>
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
      >
        <Settings size={11} />
        Open AI Settings
      </button>
    </div>
  );
}
