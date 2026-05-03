'use client';

import { Layers, Loader2, Paperclip, Send, X } from 'lucide-react';
import { type KeyboardEvent, type RefObject } from 'react';
import type { Layer } from '@/lib/layerStore';

export interface ChatComposerProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  onInputChange: (next: string) => void;
  attachedLayers: Layer[];
  onDetachLayer: (layerId: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  isLoading: boolean;
  attachCap: number;
}

export function ChatComposer({
  textareaRef, input, onInputChange, attachedLayers, onDetachLayer, onSend,
  isStreaming, isLoading, attachCap,
}: ChatComposerProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const placeholder =
    attachedLayers.length > 0
      ? `Ask about or request changes to "${attachedLayers.map((l) => l.name).join(', ')}"…`
      : 'Send a message… (Enter to send, Shift+Enter for newline)';

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white dark:border-white/10 dark:bg-gray-950">
      {attachedLayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2 dark:border-white/5">
          <Paperclip size={11} className="flex-shrink-0 text-indigo-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Context:</span>
          {attachedLayers.map((layer) => (
            <span
              key={layer.id}
              className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-indigo-900/40 dark:text-blue-300"
            >
              <Layers size={10} />
              {layer.name}
              <span className="text-[9px] text-indigo-400">({layer.nodes.length})</span>
              <button
                onClick={() => onDetachLayer(layer.id)}
                aria-label={`Detach ${layer.name}`}
                className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {attachedLayers.length}/{attachCap}
          </span>
        </div>
      )}

      <div className="mx-auto flex max-w-4xl items-end gap-3 p-4">
        <textarea
          ref={textareaRef}
          rows={2}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming || isLoading}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none ring-1 ring-gray-300 transition focus:ring-blue-400/70 disabled:opacity-50 dark:bg-white/[0.06] dark:text-white dark:placeholder-indigo-300/40 dark:ring-white/15 dark:focus:ring-blue-400/50"
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isStreaming || isLoading}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
