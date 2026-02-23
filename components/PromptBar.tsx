'use client';

import { useState, type KeyboardEvent } from 'react';
import { Sparkles, Loader2, Send, ChevronUp, ChevronDown } from 'lucide-react';

interface PromptBarProps {
  onGenerate: (prompt: string) => Promise<void>;
  isLoading: boolean;
  status?: string;
}

const EXAMPLES = [
  'Create a microservices e-commerce architecture',
  'Design a real-time chat app with WebSockets',
  'Show a data pipeline with Kafka and Spark',
  'Draw a multi-region AWS deployment with failover',
  'Build an auth service with OAuth and JWT',
];

export default function PromptBar({ onGenerate, isLoading, status }: PromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [showExamples, setShowExamples] = useState(false);

  const submit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;
    await onGenerate(trimmed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white shadow-lg">
      {showExamples && (
        <div className="border-b border-slate-100 px-4 py-2">
          <p className="mb-2 text-xs font-medium text-slate-500">Example prompts:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setPrompt(ex);
                  setShowExamples(false);
                }}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-100"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-3 px-4 py-3">
        <div className="flex-shrink-0 pb-1">
          <Sparkles size={20} className={isLoading ? 'animate-pulse text-blue-400' : 'text-blue-500'} />
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe an architecture... (Enter to generate, Shift+Enter for newline)"
          rows={2}
          disabled={isLoading}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
        />

        <button
          onClick={() => setShowExamples((v) => !v)}
          className="flex-shrink-0 pb-1 text-slate-400 hover:text-slate-600"
          title="Show examples"
        >
          {showExamples ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>

        <button
          onClick={submit}
          disabled={!prompt.trim() || isLoading}
          className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{status || 'Generating...'}</span>
            </>
          ) : (
            <>
              <Send size={16} />
              <span>Generate</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
