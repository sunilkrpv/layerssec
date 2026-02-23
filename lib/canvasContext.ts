import { createContext, useContext } from 'react';

interface CanvasContextValue {
  navigateTo: (layerId: string) => void;
}

export const CanvasContext = createContext<CanvasContextValue>({
  navigateTo: () => {},
});

export function useCanvasContext(): CanvasContextValue {
  return useContext(CanvasContext);
}
