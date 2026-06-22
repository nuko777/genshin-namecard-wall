import { useState, useCallback } from 'react';
import { TOTAL } from '../utils/grid';

export function usePreview() {
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(TOTAL).fill(null));

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
    const next: (string | null)[] = Array(TOTAL).fill(null);
    for (let i = 0; i < Math.min(hashes.length, TOTAL); i++) {
      next[i] = hashes[i] ?? null;
    }
    setSlots(next);
  }, []);

  const removeSlot = useCallback((index: number) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }, []);

  const clearSlots = useCallback(() => {
    setSlots(Array(TOTAL).fill(null));
  }, []);

  return { slots, dropIntoSlot, swapSlots, fillSlots, clearSlots, removeSlot };
}
