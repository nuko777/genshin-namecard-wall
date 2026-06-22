import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Tooltip, message } from 'antd';
import type { Namecard } from '../../types';

interface NamecardDetailProps {
  card: Namecard | null;
  onClose: () => void;
}

const THEME_LABEL: Record<string, string> = {
  character: '角色',
  achievement: '成就',
  region: '地区',
  event: '活动',
  battlepass: '纪行',
};

export default function NamecardDetail({
  card,
  onClose,
}: NamecardDetailProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const themeColors = [...(card?.themeColors ?? [])].sort((a, b) => b.ratio - a.ratio);

  // 卸载时清理复制反馈定时器，避免对已卸载组件 setState
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  const handleCopyColor = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      message.success(`已复制 ${hex}`);
      setCopiedHex(hex);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedHex(current => current === hex ? null : current), 1500);
    } catch {
      message.error('复制失败');
    }
  }, []);

  if (!card) return null;

  const metaParts: string[] = [];
  if (card.theme) metaParts.push(THEME_LABEL[card.theme] || card.theme);
  if (card.region) metaParts.push(card.region);
  if (card.element) metaParts.push(card.element + '元素');
  const nameColor = themeColors[0]?.hex;

  return (
    <Modal
      open
      title={null}
      footer={null}
      width={520}
      onCancel={onClose}
      destroyOnClose
    >
      <img className="modal-detail__img" src={`/cards/${card.hash}.png`} alt={card.name} />
      <h3 className="modal-detail__name" style={nameColor ? { color: nameColor } : undefined}>
        {card.name}
      </h3>

      <div className="modal-detail__theme-colors">
        <span className="modal-detail__theme-title">主题色</span>
        {themeColors.length > 0 ? (
          <div className="modal-detail__theme-list" aria-label="主题色列表">
            {themeColors.map(theme => {
              const hex = theme.hex;
              const percent = `${(theme.ratio * 100).toFixed(1)}%`;
              return (
                <Tooltip key={`${hex}-${theme.ratio}`} title={percent}>
                  <button
                    type="button"
                    className={`modal-detail__theme-button ${copiedHex === hex ? 'modal-detail__theme-button--copied' : ''}`}
                    style={{ backgroundColor: hex }}
                    aria-label={`复制主题色 ${hex}，占比 ${percent}`}
                    onClick={() => handleCopyColor(hex)}
                  />
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <span className="modal-detail__theme-empty">暂无主题色数据</span>
        )}
      </div>

      {metaParts.length > 0 && <p className="modal-detail__meta">{metaParts.join(' · ')}</p>}
    </Modal>
  );
}
