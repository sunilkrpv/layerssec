'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TrustMapFlow } from '@/lib/trustMap';
import { severityStroke } from './trustMapColors';

interface Props {
  flows: TrustMapFlow[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  hoveredFlowEdgeId: string | null;
  hoveredCardKey: string | null;
  onFlowHover: (edgeId: string | null) => void;
  onFlowClick: (flow: TrustMapFlow) => void;
}

interface FlowPath {
  flow: TrustMapFlow;
  d: string;
}

export default function FlowOverlay({
  flows,
  containerRef,
  cardRefs,
  hoveredFlowEdgeId,
  hoveredCardKey,
  onFlowHover,
  onFlowClick,
}: Props) {
  const [paths, setPaths] = useState<FlowPath[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);

  const compute = () => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    setSize({ w: container.scrollWidth, h: container.scrollHeight });

    const next: FlowPath[] = [];
    for (const flow of flows) {
      const srcEl = cardRefs.current.get(flow.sourceCardKey);
      const tgtEl = cardRefs.current.get(flow.targetCardKey);
      if (!srcEl || !tgtEl) continue;
      const s = srcEl.getBoundingClientRect();
      const t = tgtEl.getBoundingClientRect();

      const sx = s.right - containerRect.left + scrollLeft;
      const sy = s.top + s.height / 2 - containerRect.top + scrollTop;
      const tx = t.left - containerRect.left + scrollLeft;
      const ty = t.top + t.height / 2 - containerRect.top + scrollTop;

      const dx = Math.max(40, Math.abs(tx - sx) / 2);
      const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
      next.push({ flow, d });
    }
    setPaths(next);
  };

  const schedule = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      compute();
    });
  };

  useLayoutEffect(() => {
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flows]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    const onScroll = () => schedule();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      ro.disconnect();
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', schedule);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={size.w}
      height={size.h}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="trustmap-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      {paths.map(({ flow, d }) => {
        const isHoveredFlow = hoveredFlowEdgeId === flow.edgeId;
        const isHoveredByCard =
          hoveredCardKey != null &&
          (hoveredCardKey === flow.sourceCardKey || hoveredCardKey === flow.targetCardKey);
        const active = isHoveredFlow || isHoveredByCard;
        const stroke = severityStroke(flow.highestSeverity);
        return (
          <path
            key={flow.edgeId}
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={active ? 2.5 : 1.5}
            strokeDasharray={flow.highestSeverity ? undefined : '4 3'}
            opacity={hoveredFlowEdgeId == null && hoveredCardKey == null ? 0.7 : active ? 1 : 0.2}
            color={stroke}
            markerEnd="url(#trustmap-arrow)"
            className="pointer-events-auto cursor-pointer transition"
            onMouseEnter={() => onFlowHover(flow.edgeId)}
            onMouseLeave={() => onFlowHover(null)}
            onClick={() => onFlowClick(flow)}
          />
        );
      })}
    </svg>
  );
}
