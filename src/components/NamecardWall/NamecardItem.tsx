import { memo, useCallback } from 'react';
import type { Namecard } from '../../types';

interface NamecardItemProps {
  card: Namecard;
  disabled: boolean;
  onOpen: (hash: string) => void;
  onToggle: (hash: string) => void;
}

export default memo(function NamecardItem({
  card,
  disabled,
  onOpen,
  onToggle,
}: NamecardItemProps) {
  const labelColor = card.themeColors[0]?.hex;
  const handleClick = useCallback(() => onOpen(card.hash), [onOpen, card.hash]);
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onToggle(card.hash);
    },
    [onToggle, card.hash]
  );
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', card.hash);
      e.dataTransfer.effectAllowed = 'move';
    },
    [card.hash]
  );

  return (
    <div
      className={`namecard-thumb ${disabled ? 'namecard-thumb--disabled' : ''}`}
      draggable
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      title={card.name}
    >
      <img src={`/cards/${card.hash}.png`} alt={card.name} loading="lazy" />
      <span className="namecard-thumb__label" style={labelColor ? { color: labelColor } : undefined}>
        {card.name}
      </span>
    </div>
  );
});
