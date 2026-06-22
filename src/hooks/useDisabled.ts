import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'genshin_namewall_disabled';

export function useDisabled() {
  const [disabledSet, setDisabledSet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      // 仅接纳字符串项，防止非法存储污染集合
      return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
    } catch {
      return new Set();
    }
  });

  // 持久化副作用置于 updater 外，集合变化时同步写回 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...disabledSet]));
  }, [disabledSet]);

  const toggle = useCallback((hash: string) => {
    setDisabledSet(prev => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  return { disabledSet, toggle };
}
