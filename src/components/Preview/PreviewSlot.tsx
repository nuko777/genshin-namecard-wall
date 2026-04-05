import { useState, useEffect } from 'react';
import type { Namecard } from '../../types';

interface PreviewSlotProps {
  index: number;
  hash: string | null;
  namecardMap: Map<string, Namecard>;
  didDropRef: React.MutableRefObject<boolean>;
  onDrop: (index: number, hash: string) => void;
  onSwap: (a: number, b: number) => void;
  onRemove: (index: number) => void;
}

export default function PreviewSlot({
  index,
  hash,
  namecardMap,
  didDropRef,
  onDrop,
  onSwap,
  onRemove,
}: PreviewSlotProps) {
  const card = hash ? namecardMap.get(hash) ?? null : null;
  const [dragOver, setDragOver] = useState(false);

  // Reset shared drop flag on each new drag
  useEffect(() => {
    const reset = () => { didDropRef.current = false; };
    window.addEventListener('dragstart', reset);
    return () => window.removeEventListener('dragstart', reset);
  }, [didDropRef]);

  const handleDragStart = (e: React.DragEvent) => {
    if (!hash) return;
    e.dataTransfer.setData('text/plain', `slot:${index}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    didDropRef.current = true; // shared flag — prevents deletion on all slots
    const data = e.dataTransfer.getData('text/plain');

    if (!data.startsWith('slot:')) {
      onDrop(index, data);
      return;
    }

    const fromIndex = parseInt(data.slice(5), 10);
    if (!isNaN(fromIndex) && fromIndex !== index) {
      onSwap(fromIndex, index);
    }
  };

  const handleDragEnd = () => {
    setDragOver(false);
    if (!didDropRef.current && hash) {
      onRemove(index);
    }
  };

  return (
    <div
      className={`preview-slot ${dragOver ? 'preview-slot--over' : ''}`}
      draggable={!!hash}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      {card ? (
        <img
          src={`/cards/${card.hash}.png`}
          alt={card.name}
          title={`${card.name}（拖拽交换 / 拖出删除）`}
        />
      ) : (
        <span className="preview-slot__index">{index + 1}</span>
      )}
    </div>
  );
}
