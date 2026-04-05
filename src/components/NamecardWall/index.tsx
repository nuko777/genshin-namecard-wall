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
  return (
    <div className="namecard-wall">
      <div className="namecard-wall__header">
        <h2>名片墙</h2>
        <FilterBar
          filter={filter}
          count={filteredNamecards.length}
          total={totalNamecards}
          onChange={onFilterChange}
        />
      </div>
      <div className="namecard-wall__grid">
        {filteredNamecards.map(card => (
          <NamecardItem
            key={card.hash}
            card={card}
            disabled={disabledSet.has(card.hash)}
            onOpen={onOpenModal}
            onToggle={onToggleDisable}
          />
        ))}
      </div>
    </div>
  );
}
