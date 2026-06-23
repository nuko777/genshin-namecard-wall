import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Namecard, FilterState } from '../types';
import { fuzzyMatch } from '../utils/fuzzyMatch';

export function useNamecards() {
  const [namecards, setNamecards] = useState<Namecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterState>({
    theme: '',
    region: '',
    element: '',
    search: '',
    hideDisabled: true,
    enableBattlepass: false,
  });

  useEffect(() => {
    const ac = new AbortController();
    fetch('/namecards.json', { signal: ac.signal })
      .then(r => r.json() as Promise<Namecard[]>)
      .then(cards => {
        setNamecards(cards);
        setLoading(false);
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load namecards:', e);
        setLoading(false);
      });
    return () => ac.abort();
  }, []);

  const colorMap = useMemo(() => {
    const m = new Map<string, Namecard>();
    namecards.forEach(c => m.set(c.hash, c));
    return m;
  }, [namecards]);

  const filteredNamecards = useMemo<Namecard[]>(() => {
    const scored: Array<{ card: Namecard; score: number }> = [];

    for (const c of namecards) {
      if (!filter.enableBattlepass && c.theme === 'battlepass') continue;
      if (filter.theme && c.theme !== filter.theme) continue;
      if (filter.region && c.region !== filter.region) continue;
      if (filter.element && c.element !== filter.element) continue;

      if (filter.search) {
        const score = fuzzyMatch(filter.search, c.name);
        if (!score) continue;
        scored.push({ card: c, score });
      } else {
        scored.push({ card: c, score: 0 });
      }
    }

    // Sort by fuzzy match score descending when a search query is active
    if (filter.search) {
      scored.sort((a, b) => b.score - a.score);
    }

    return scored.map(s => s.card);
  }, [namecards, filter]);

  // 匹配池：受分类筛选影响，但不受搜索影响，避免按名称查找时预览整盘洗牌。
  const matchPool = useMemo<Namecard[]>(() => {
    return namecards.filter(c => {
      if (!filter.enableBattlepass && c.theme === 'battlepass') return false;
      if (filter.theme && c.theme !== filter.theme) return false;
      if (filter.region && c.region !== filter.region) return false;
      if (filter.element && c.element !== filter.element) return false;
      return true;
    });
  }, [namecards, filter.enableBattlepass, filter.theme, filter.region, filter.element]);

  const updateFilter = useCallback(
    (partial: Partial<FilterState>) => {
      setFilter(prev => ({ ...prev, ...partial }));
    },
    []
  );

  return { namecards, colorMap, filteredNamecards, matchPool, loading, filter, updateFilter };
}
