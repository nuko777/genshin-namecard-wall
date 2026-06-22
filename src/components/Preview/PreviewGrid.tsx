import { useRef } from 'react';
import PreviewSlot from './PreviewSlot';
import type { Namecard, GradientDirection } from '../../types';
import { getSlotWeight, DIAGONAL_COUNT } from '../../utils/grid';

interface PreviewGridProps {
  slots: (string | null)[];
  colorMap: Map<string, Namecard>;
  fillMode: boolean;
  direction: GradientDirection;
  onDrop: (index: number, hash: string) => void;
  onSwap: (a: number, b: number) => void;
  onRemove: (index: number) => void;
}

export default function PreviewGrid({
  slots,
  colorMap,
  fillMode,
  direction,
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
      {slots.map((hash, i) => {
        const weight = getSlotWeight(i, direction);
        const isEndpoint = weight === 0 || weight === DIAGONAL_COUNT - 1;
        return (
          <PreviewSlot
            key={`slot-${i}`}
            index={i}
            hash={hash}
            colorMap={colorMap}
            didDropRef={didDropRef}
            endpoint={fillMode && isEndpoint}
            onDrop={onDrop}
            onSwap={onSwap}
            onRemove={onRemove}
          />
        );
      })}
    </div>
  );
}
