'use client';

import { useCallback } from 'react';
import { Box, Layers } from 'lucide-react';
import type { TrustMapCard } from '@/lib/trustMap';

interface Props {
  card: TrustMapCard;
  highlighted?: boolean;
  onClick: () => void;
  onDrill?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  registerRef?: (cardKey: string, el: HTMLDivElement | null) => void;
}

export default function NodeCard({
  card,
  highlighted,
  onClick,
  onDrill,
  onMouseEnter,
  onMouseLeave,
  registerRef,
}: Props) {
  const cardKey = card.key;
  const cardRef = useCallback(
    (el: HTMLDivElement | null) => {
      registerRef?.(cardKey, el);
    },
    [cardKey, registerRef],
  );
  return (
    <div
      ref={cardRef}
      data-card-key={card.key}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group cursor-pointer rounded-md border bg-white px-2.5 py-2 shadow-sm transition dark:bg-slate-800
        ${highlighted
          ? 'border-blue-400 ring-2 ring-blue-300 dark:border-blue-500 dark:ring-blue-700'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}
      `}
    >
      <div className="flex items-center gap-1.5">
        <Box size={11} className="text-slate-400" />
        <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
          {card.label}
        </span>
        {onDrill && (
          <button
            onClick={(e) => { e.stopPropagation(); onDrill(); }}
            title={`Drill into ${card.label}`}
            className="ml-auto flex-shrink-0 rounded p-0.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            <Layers size={11} />
          </button>
        )}
      </div>
      {card.subtitle && (
        <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
          {card.subtitle}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1">
        <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
          {card.layerName}
        </span>
      </div>
    </div>
  );
}
