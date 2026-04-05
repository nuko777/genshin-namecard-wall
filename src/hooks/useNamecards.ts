import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Namecard, FilterState } from '../types';

export function useNamecards() {
  const [namecards, setNamecards] = useState<Namecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterState>({
    theme: '',
    region: '',
    element: '',
    search: '',
    hideDisabled: true,
  });

  useEffect(() => {
    const ac = new AbortController();
    fetch('/data.json', { signal: ac.signal })
      .then(r => r.json())
      .then((data: Namecard[]) => {
        setNamecards(data);
        setLoading(false);
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load namecards:', e);
        setLoading(false);
      });
    return () => ac.abort();
  }, []);

  const filteredNamecards = useMemo<Namecard[]>(() => {
    return namecards.filter(c => {
      if (filter.theme && c.theme !== filter.theme) return false;
      if (filter.region && c.region !== filter.region) return false;
      if (filter.element && c.element !== filter.element) return false;
      if (filter.search && !c.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }, [namecards, filter]);

  const updateFilter = useCallback(
    (partial: Partial<FilterState>) => {
      setFilter(prev => ({ ...prev, ...partial }));
    },
    []
  );

  return { namecards, filteredNamecards, loading, filter, updateFilter };
}
