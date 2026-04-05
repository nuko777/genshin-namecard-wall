import { useState, useCallback } from 'react';

const STORAGE_KEY = 'genshin_namewall_disabled';

export function useDisabled() {
  const [disabledSet, setDisabledSet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const isDisabled = useCallback(
    (hash: string) => disabledSet.has(hash),
    [disabledSet]
  );

  const toggle = useCallback((hash: string) => {
    setDisabledSet(prev => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { disabledSet, isDisabled, toggle };
}
