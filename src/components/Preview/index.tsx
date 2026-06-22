import { useRef, useState } from 'react';
import PreviewGrid from './PreviewGrid';
import GradientPanel from './GradientPanel';
import ActionButtons from './ActionButtons';
import type { Namecard, GradientDirection, GradientPreset } from '../../types';
import { exportPreview } from '../../utils/export';
import { DIAGONAL_COUNT, getSlotWeight } from '../../utils/grid';

interface PreviewProps {
  slots: (string | null)[];
  colorMap: Map<string, Namecard>;
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
  onDrop: (index: number, hash: string) => void;
  onSwap: (a: number, b: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onCopyLayout: () => void;
  onImportLayout: () => void;
}

/** 生成导出文件名：起点 hash_终点 hash_本地时间。 */
function buildExportFileName(slots: (string | null)[], direction: GradientDirection): string {
  const startIndex = slots.findIndex((_, index) => getSlotWeight(index, direction) === 0);
  const endIndex = slots.findIndex((_, index) => getSlotWeight(index, direction) === DIAGONAL_COUNT - 1);
  const startHash = startIndex >= 0 ? slots[startIndex] ?? 'empty' : 'empty';
  const endHash = endIndex >= 0 ? slots[endIndex] ?? 'empty' : 'empty';
  const timestamp = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, '')
    .replace(/[-:T]/g, '');
  return `genshin_namecard_${startHash}_${endHash}_${timestamp}.png`;
}

export default function Preview({
  slots,
  colorMap,
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
  onDrop,
  onSwap,
  onRemove,
  onClear,
  onCopyLayout,
  onImportLayout,
}: PreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    if (!previewRef.current) return;
    setExportLoading(true);
    try {
      const dataUrl = await exportPreview(previewRef.current);
      const a = document.createElement('a');
      a.download = buildExportFileName(slots, direction);
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="preview">
      <div className="preview__header">
        <h2>预览 (4×4)</h2>
        <ActionButtons
          onClear={onClear}
          onExport={handleExport}
          exportLoading={exportLoading}
          onCopyLayout={onCopyLayout}
          onImportLayout={onImportLayout}
        />
      </div>

      <GradientPanel
        color1={color1}
        color2={color2}
        direction={direction}
        fillMode={fillMode}
        presets={presets}
        onColor1Change={onColor1Change}
        onColor2Change={onColor2Change}
        onDirectionChange={onDirectionChange}
        onFillModeChange={onFillModeChange}
        onPresetSelect={onPresetSelect}
      />

      <div ref={previewRef} className="preview__capture">
        <PreviewGrid
          slots={slots}
          colorMap={colorMap}
          fillMode={fillMode}
          direction={direction}
          onDrop={onDrop}
          onSwap={onSwap}
          onRemove={onRemove}
        />
      </div>

    </div>
  );
}
