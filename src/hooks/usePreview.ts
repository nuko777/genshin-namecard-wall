import { useState, useCallback } from 'react';

const GRID_SIZE = 16;

export function usePreview() {
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(GRID_SIZE).fill(null));

  const dropIntoSlot = useCallback((targetIndex: number, hash: string) => {
    setSlots(prev => {
      const next = prev.map(h => (h === hash ? null : h));
      next[targetIndex] = hash;
      return next;
    });
  }, []);

  const swapSlots = useCallback((a: number, b: number) => {
    setSlots(prev => {
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }, []);

  const fillSlots = useCallback((hashes: (string | null)[]) => {
    setSlots(prev => {
      const next = [...prev];
      for (let i = 0; i < Math.min(hashes.length, GRID_SIZE); i++) {
        next[i] = hashes[i] || null;
      }
      return next;
    });
  }, []);

  const removeSlot = useCallback((index: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  const clearSlots = useCallback(() => {
    setSlots(Array(GRID_SIZE).fill(null));
  }, []);

  return { slots, dropIntoSlot, swapSlots, fillSlots, clearSlots, removeSlot };
}
