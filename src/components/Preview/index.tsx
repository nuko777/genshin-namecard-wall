import { useRef, useState } from 'react';
import PreviewGrid from './PreviewGrid';
import GradientPanel from './GradientPanel';
import ActionButtons from './ActionButtons';
import type { Namecard, GradientDirection, GradientPreset } from '../../types';
import { exportPreview } from '../../utils/export';

interface PreviewProps {
  slots: (string | null)[];
  namecardMap: Map<string, Namecard>;
  color1: string;
  color2: string;
  direction: GradientDirection;
  presets: GradientPreset[];
  onColor1Change: (c: string) => void;
  onColor2Change: (c: string) => void;
  onDirectionChange: (d: GradientDirection) => void;
  onPresetSelect: (p: GradientPreset) => void;
  onGenerate: () => void;
  onDrop: (index: number, hash: string) => void;
  onSwap: (a: number, b: number) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
}

export default function Preview({
  slots,
  namecardMap,
  color1,
  color2,
  direction,
  presets,
  onColor1Change,
  onColor2Change,
  onDirectionChange,
  onPresetSelect,
  onGenerate,
  onDrop,
  onSwap,
  onRemove,
  onClear,
}: PreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExport = async () => {
    if (!previewRef.current) return;
    setExportLoading(true);
    try {
      const dataUrl = await exportPreview(previewRef.current);
      const a = document.createElement('a');
      a.download = 'namecard_preview.png';
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
      <h2>预览 (4×4)</h2>

      <GradientPanel
        color1={color1}
        color2={color2}
        direction={direction}
        presets={presets}
        onColor1Change={onColor1Change}
        onColor2Change={onColor2Change}
        onDirectionChange={onDirectionChange}
        onPresetSelect={onPresetSelect}
        onGenerate={onGenerate}
      />

      <div ref={previewRef} className="preview__capture">
        <PreviewGrid
          slots={slots}
          namecardMap={namecardMap}
          onDrop={onDrop}
          onSwap={onSwap}
          onRemove={onRemove}
        />
      </div>

      <ActionButtons
        onClear={onClear}
        onExport={handleExport}
        exportLoading={exportLoading}
      />
    </div>
  );
}
