'use client';

import { GripVertical } from 'lucide-react';
import type { TrustMapColumn } from '@/lib/trustMap';
import { TRUST_LEVEL_STYLES } from './trustMapColors';
import NodeCard from './NodeCard';

interface Props {
  column: TrustMapColumn;
  highlightedCardKeys: Set<string>;
  onCardClick: (card: TrustMapColumn['cards'][number]) => void;
  onCardDrill: (card: TrustMapColumn['cards'][number]) => void;
  onCardHover: (cardKey: string | null) => void;
  registerCardRef: (cardKey: string, el: HTMLDivElement | null) => void;
  draggable?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}

export default function KanbanColumn({
  column,
  highlightedCardKeys,
  onCardClick,
  onCardDrill,
  onCardHover,
  registerCardRef,
  draggable,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const style = TRUST_LEVEL_STYLES[column.trustLevel];
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex w-60 flex-shrink-0 flex-col rounded-md border bg-white transition dark:bg-slate-900
        ${isDragging ? 'opacity-40' : ''}
        ${isDragOver
          ? 'border-blue-400 ring-2 ring-blue-300 dark:border-blue-500 dark:ring-blue-700'
          : 'border-slate-200 dark:border-slate-700'}
      `}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-1.5 dark:border-slate-700">
        <div className="flex min-w-0 items-center gap-1.5">
          {draggable && (
            <GripVertical
              size={11}
              className="flex-shrink-0 cursor-grab text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500 dark:hover:text-slate-300"
            />
          )}
          <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-100">
            {column.label}
          </span>
          <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider ${style.badge}`}>
            {style.label}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">{column.cards.length}</span>
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto p-2">
        {column.cards.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 px-2 py-3 text-center text-[10px] text-slate-400 dark:border-slate-700">
            no nodes in this boundary
          </div>
        ) : (
          column.cards.map((card) => (
            <NodeCard
              key={card.key}
              card={card}
              highlighted={highlightedCardKeys.has(card.key)}
              onClick={() => onCardClick(card)}
              onDrill={card.childLayerId ? () => onCardDrill(card) : undefined}
              onMouseEnter={() => onCardHover(card.key)}
              onMouseLeave={() => onCardHover(null)}
              registerRef={registerCardRef}
            />
          ))
        )}
      </div>
    </div>
  );
}
