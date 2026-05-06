'use client';

import { Layers } from 'lucide-react';
import { useCanvasContext } from '@/lib/canvasContext';

interface ChildLayerBadgeProps {
  childLayerId: string;
}

export default function ChildLayerBadge({ childLayerId }: ChildLayerBadgeProps) {
  const { navigateTo } = useCanvasContext();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigateTo(childLayerId);
      }}
      title="Open child layer"
      className="nodrag nowheel absolute bottom-1 right-1 z-10 flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white shadow hover:bg-blue-700"
    >
      <Layers size={11} />
    </button>
  );
}
