import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Namecard, FilterState } from '../../types';
import NamecardItem from './NamecardItem';
import FilterBar from './FilterBar';

interface NamecardWallProps {
  filteredNamecards: Namecard[];
  totalNamecards: number;
  filter: FilterState;
  disabledSet: Set<string>;
  onFilterChange: (partial: Partial<FilterState>) => void;
  onToggleDisable: (hash: string) => void;
  onOpenModal: (hash: string) => void;
}

export default function NamecardWall({
  filteredNamecards,
  totalNamecards,
  filter,
  disabledSet,
  onFilterChange,
  onToggleDisable,
  onOpenModal,
}: NamecardWallProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.scrollTop = Math.min(lastScrollTopRef.current, grid.scrollHeight - grid.clientHeight);
  }, [filteredNamecards, disabledSet]);

  const handleScroll = useCallback(() => {
    lastScrollTopRef.current = gridRef.current?.scrollTop ?? 0;
  }, []);

  const handleToggleDisable = useCallback((hash: string) => {
    lastScrollTopRef.current = gridRef.current?.scrollTop ?? lastScrollTopRef.current;
    onToggleDisable(hash);
  }, [onToggleDisable]);

  return (
    <div className="namecard-wall">
      <div className="namecard-wall__header">
        <h2>
          名片墙
          <span className="namecard-wall__hint">右键点击名片切换启用/禁用</span>
        </h2>
        <FilterBar
          filter={filter}
          count={filteredNamecards.length}
          total={totalNamecards}
          onChange={onFilterChange}
        />
      </div>
      <div ref={gridRef} className="namecard-wall__grid" onScroll={handleScroll}>
        {filteredNamecards.map(card => (
          <NamecardItem
            key={card.hash}
            card={card}
            disabled={disabledSet.has(card.hash)}
            onOpen={onOpenModal}
            onToggle={handleToggleDisable}
          />
        ))}
      </div>
    </div>
  );
}
