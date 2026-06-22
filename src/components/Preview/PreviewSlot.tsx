import { useState, useEffect } from 'react';
import type { Namecard } from '../../types';

interface PreviewSlotProps {
  index: number;
  hash: string | null;
  colorMap: Map<string, Namecard>;
  didDropRef: React.MutableRefObject<boolean>;
  endpoint?: boolean;
  onDrop: (index: number, hash: string) => void;
  onSwap: (a: number, b: number) => void;
  onRemove: (index: number) => void;
}

export default function PreviewSlot({
  index,
  hash,
  colorMap,
  didDropRef,
  endpoint = false,
  onDrop,
  onSwap,
  onRemove,
}: PreviewSlotProps) {
  const card = hash ? colorMap.get(hash) ?? null : null;
  const primaryThemeColor = card?.themeColors?.[0] ?? null;
  const title = card
    ? primaryThemeColor
      ? `${card.name} · ${primaryThemeColor.hex} · 主题色占比 ${Math.round(primaryThemeColor.ratio * 100)}%（拖拽交换 / 拖出删除）`
      : `${card.name} · 无主题色数据（拖拽交换 / 拖出删除）`
    : '';
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
      className={`preview-slot ${dragOver ? 'preview-slot--over' : ''} ${endpoint ? 'preview-slot--endpoint' : ''}`}
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
          title={title}
        />
      ) : (
        <span className="preview-slot__index">{index + 1}</span>
      )}
    </div>
  );
}
