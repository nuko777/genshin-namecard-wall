import { Modal, Button } from 'antd';
import type { Namecard } from '../../types';

interface NamecardDetailProps {
  card: Namecard | null;
  disabled: boolean;
  onClose: () => void;
  onToggleDisable: () => void;
}

const THEME_LABEL: Record<string, string> = {
  character: '角色',
  achievement: '成就',
  region: '地区',
  event: '活动',
  other: '其他',
};

export default function NamecardDetail({
  card,
  disabled,
  onClose,
  onToggleDisable,
}: NamecardDetailProps) {
  if (!card) return null;

  const metaParts: string[] = [];
  if (card.theme) metaParts.push(THEME_LABEL[card.theme] || card.theme);
  if (card.region) metaParts.push(card.region);
  if (card.element) metaParts.push(card.element + '元素');
  if (card.avgColor.length >= 3) {
    const [r, g, b] = card.avgColor;
    metaParts.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
  }

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
      <h3 className="modal-detail__name">{card.name}</h3>
      <p className="modal-detail__meta">{metaParts.join(' · ') || '暂无信息'}</p>
      <p className="modal-detail__desc">{card.description || '暂无介绍'}</p>
      <p className="modal-detail__obtain">{card.obtainMethod || '暂无获取信息'}</p>
      <Button
        block
        danger={!disabled}
        type={disabled ? 'primary' : 'default'}
        onClick={onToggleDisable}
      >
        {disabled ? '启用此名片' : '禁用此名片'}
      </Button>
    </Modal>
  );
}
