import { useRef } from 'react';
import PreviewSlot from './PreviewSlot';
import type { Namecard } from '../../types';

interface PreviewGridProps {
  slots: (string | null)[];
  namecardMap: Map<string, Namecard>;
  onDrop: (index: number, hash: string) => void;
  onSwap: (a: number, b: number) => void;
  onRemove: (index: number) => void;
}

export default function PreviewGrid({
  slots,
  namecardMap,
  onDrop,
  onSwap,
  onRemove,
}: PreviewGridProps) {
  // Shared across all slots: prevents dragEnd from deleting a card
  // that was successfully dropped on another slot.
  const didDropRef = useRef(false);

  return (
    <div
      className="preview-grid"
      onDragOver={e => e.preventDefault()}
    >
      {slots.map((hash, i) => (
        <PreviewSlot
          key={`slot-${i}`}
          index={i}
          hash={hash}
          namecardMap={namecardMap}
          didDropRef={didDropRef}
          onDrop={onDrop}
          onSwap={onSwap}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
