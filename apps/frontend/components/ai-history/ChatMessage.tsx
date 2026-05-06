'use client';

import { Layers, Sparkles, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { mdComponents } from '@/lib/markdownRenderers';
import { formatChatTime, splitDiagramContent, type DiagramPayload } from '@/lib/aiHistoryHelpers';
import type { ChatMessage as ChatMessageType } from '@/lib/api';
import { DiagramBubble } from '@/components/ai-history/DiagramBubble';

export interface ChatMessageProps {
  msg: ChatMessageType;
  /** Streaming buffer used in lieu of msg.content while the assistant is mid-response. */
  streamingContent?: string;
  /** Additional layer names tagged at send time (multi-attach). May be empty/undefined. */
  extraLayerNames?: string[];
  onApplyDiagram: (diagram: DiagramPayload) => void;
  onMaximizeDiagram: (diagram: DiagramPayload, layerName?: string) => void;
}

export function ChatMessage({
  msg, streamingContent, extraLayerNames, onApplyDiagram, onMaximizeDiagram,
}: ChatMessageProps) {
  const isUser = msg.role === 'user';
  const raw = streamingContent ?? msg.content;
  const { text: displayText, diagram: diagramPayload } = splitDiagramContent(raw);

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="max-w-[85%] min-w-0">
          <div className="rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white">
            {msg.content}
          </div>
          <div className="mt-1 text-right text-[10px] text-gray-400 dark:text-blue-300/40">
            {formatChatTime(msg.createdAt)}
          </div>
        </div>
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 ring-1 ring-indigo-200 dark:bg-blue-500/30 dark:ring-indigo-400/30">
          <User size={13} className="text-blue-600 dark:text-indigo-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 ring-1 ring-indigo-200 dark:bg-blue-500/30 dark:ring-indigo-400/40">
        <Sparkles size={12} className="text-blue-500 dark:text-blue-300" />
      </div>
      <div className="max-w-[85%] min-w-0">
        {(msg.layerName || (extraLayerNames && extraLayerNames.length > 0)) && (
          <div className="mb-1 flex flex-wrap gap-1">
            {msg.layerName && (
              <span className="flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-500 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300/60">
                <Layers size={8} /> {msg.layerName}
              </span>
            )}
            {extraLayerNames?.map((name) => (
              <span
                key={name}
                className="flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-500 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300/60"
              >
                <Layers size={8} /> {name}
              </span>
            ))}
          </div>
        )}
        <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-2.5 text-gray-700 ring-1 ring-gray-200 dark:bg-white/[0.06] dark:text-indigo-100/90 dark:ring-white/10">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {displayText}
          </ReactMarkdown>
          {diagramPayload && (
            <DiagramBubble
              diagram={diagramPayload}
              onApply={() => onApplyDiagram(diagramPayload)}
              onMaximize={() => onMaximizeDiagram(diagramPayload, msg.layerName ?? undefined)}
            />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-gray-400 dark:text-blue-300/40">
            {formatChatTime(msg.createdAt)}
          </span>
          {msg.model && (
            <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-blue-300/50">
              {msg.provider ? `${msg.provider}/` : ''}{msg.model}
            </span>
          )}
          {(msg.inputTokens || msg.outputTokens) && (
            <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-blue-300/40">
              {msg.inputTokens ? `↑${msg.inputTokens}` : ''}
              {msg.inputTokens && msg.outputTokens ? ' ' : ''}
              {msg.outputTokens ? `↓${msg.outputTokens}` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
