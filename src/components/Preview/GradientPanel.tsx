import { Button, Space } from 'antd';
import type { GradientDirection, GradientPreset } from '../../types';

interface GradientPanelProps {
  color1: string;
  color2: string;
  direction: GradientDirection;
  presets: GradientPreset[];
  onColor1Change: (c: string) => void;
  onColor2Change: (c: string) => void;
  onDirectionChange: (d: GradientDirection) => void;
  onPresetSelect: (p: GradientPreset) => void;
  onGenerate: () => void;
}

export default function GradientPanel({
  color1,
  color2,
  direction,
  presets,
  onColor1Change,
  onColor2Change,
  onDirectionChange,
  onPresetSelect,
  onGenerate,
}: GradientPanelProps) {
  return (
    <div className="gradient-panel">
      <div className="gradient-panel__row">
        <span className="gradient-panel__label">颜色 1:</span>
        <div className="gradient-panel__color-node" style={{ backgroundColor: color1 }}>
          <input type="color" value={color1} onChange={e => onColor1Change(e.target.value)} />
        </div>
        <span className="gradient-panel__label">颜色 2:</span>
        <div className="gradient-panel__color-node" style={{ backgroundColor: color2 }}>
          <input type="color" value={color2} onChange={e => onColor2Change(e.target.value)} />
        </div>
      </div>

      <div className="gradient-panel__row">
        <span className="gradient-panel__label">方向:</span>
        <Space size="small">
          <Button
            size="small"
            type={direction === 'tl-br' ? 'primary' : 'default'}
            onClick={() => onDirectionChange('tl-br')}
          >
            左上到右下
          </Button>
          <Button
            size="small"
            type={direction === 'tr-bl' ? 'primary' : 'default'}
            onClick={() => onDirectionChange('tr-bl')}
          >
            右上到左下
          </Button>
        </Space>
      </div>

      <div className="gradient-panel__row gradient-panel__presets">
        <span className="gradient-panel__label">预设方案:</span>
        <Space size="small" wrap>
          {presets.map(p => (
            <Button
              key={p.name}
              size="small"
              onClick={() => onPresetSelect(p)}
            >
              <span
                className="gradient-panel__gradient-swatch"
                style={{ background: `linear-gradient(135deg, ${p.color1}, ${p.color2})` }}
              />
              {p.name}
            </Button>
          ))}
        </Space>
      </div>

      <div className="gradient-panel__row">
        <Button type="primary" onClick={onGenerate}>
          生成渐变
        </Button>
      </div>
    </div>
  );
}
