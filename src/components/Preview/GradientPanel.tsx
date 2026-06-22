import { Button, Space, Switch, Tooltip } from 'antd';
import type { GradientDirection, GradientPreset } from '../../types';

interface GradientPanelProps {
  color1: string;
  color2: string;
  direction: GradientDirection;
  fillMode: boolean;
  presets: GradientPreset[];
  onColor1Change: (c: string) => void;
  onColor2Change: (c: string) => void;
  onDirectionChange: (d: GradientDirection) => void;
  onFillModeChange: (v: boolean) => void;
  onPresetSelect: (p: GradientPreset) => void;
}

export default function GradientPanel({
  color1,
  color2,
  direction,
  fillMode,
  presets,
  onColor1Change,
  onColor2Change,
  onDirectionChange,
  onFillModeChange,
  onPresetSelect,
}: GradientPanelProps) {
  const isReverseDirection = direction === 'tr-bl';

  return (
    <div className="gradient-panel">
      <div className="gradient-panel__row">
        <span className="gradient-panel__label">颜色 1:</span>
        <div className="gradient-panel__color-node" style={{ backgroundColor: color1 }}>
          <input
            type="color"
            name="gradient-start-color"
            aria-label="渐变起始色"
            disabled={fillMode}
            value={color1}
            onChange={e => onColor1Change(e.target.value)}
          />
        </div>
        <span className="gradient-panel__label">颜色 2:</span>
        <div className="gradient-panel__color-node" style={{ backgroundColor: color2 }}>
          <input
            type="color"
            name="gradient-end-color"
            aria-label="渐变结束色"
            disabled={fillMode}
            value={color2}
            onChange={e => onColor2Change(e.target.value)}
          />
        </div>
        <span className="gradient-panel__label">方向:</span>
        <Switch
          checked={isReverseDirection}
          onChange={checked => onDirectionChange(checked ? 'tr-bl' : 'tl-br')}
          checkedChildren={<span className="gradient-panel__direction-icon">↙</span>}
          unCheckedChildren={<span className="gradient-panel__direction-icon">↘</span>}
          aria-label={isReverseDirection ? '右上到左下' : '左上到右下'}
        />
        <Tooltip title="开启后，把名片拖到起点角/止点角即可将该端渐变色取为名片色并重新生成">
          <span className="gradient-panel__label">填充模式:</span>
        </Tooltip>
        <Switch
          checked={fillMode}
          onChange={onFillModeChange}
          checkedChildren="开"
          unCheckedChildren="关"
          aria-label="填充模式"
        />
      </div>

      <div className="gradient-panel__row gradient-panel__presets">
        <span className="gradient-panel__label">预设方案:</span>
        <Space size="small" wrap>
          {presets.map(p => (
            <Button
              key={p.name}
              size="small"
              disabled={fillMode}
              onClick={() => onPresetSelect(p)}
            >
              <span
                className="gradient-panel__gradient-swatch"
              >
                <span style={{ backgroundColor: p.color1 }} />
                <span style={{ backgroundColor: p.color2 }} />
              </span>
              {p.name}
            </Button>
          ))}
        </Space>
      </div>
    </div>
  );
}
