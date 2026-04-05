import { useState, useCallback } from 'react';
import { generateTargetColors, solveMinimumCostMatching } from '../utils/gradient';
import type { Candidate } from '../utils/gradient';
import type { GradientPreset, GradientDirection } from '../types';

const PRESETS: GradientPreset[] = [
  // ── 原神元素主题（高饱和） ──
  { name: '蒙德·风',   color1: '#00e5b8', color2: '#00695c' },
  { name: '璃月·岩',   color1: '#ffd54f', color2: '#e65100' },
  { name: '稻妻·雷',   color1: '#ea80fc', color2: '#6a1b9a' },
  { name: '须弥·草',   color1: '#69f0ae', color2: '#1b5e20' },
  { name: '枫丹·水',   color1: '#40c4ff', color2: '#0d47a1' },
  { name: '纳塔·火',   color1: '#ff6e40', color2: '#bf360c' },
  { name: '至冬·冰',   color1: '#80d8ff', color2: '#004d73' },
  // ── 经典渐变 ──
  { name: '落日橘',    color1: '#ff7e5f', color2: '#feb47b' },
  { name: '深海蓝',    color1: '#2193b0', color2: '#6dd5ed' },
  { name: '紫罗兰梦',  color1: '#8e2de2', color2: '#4a00e0' },
  { name: '樱桃红',    color1: '#eb3349', color2: '#f45c43' },
  { name: '极光绿',    color1: '#11998e', color2: '#38ef7d' },
  { name: '蓝空',     color1: '#56ccf2', color2: '#2f80ed' },
  { name: '紫爱',     color1: '#cc2b5e', color2: '#753a88' },
  { name: '电光紫',    color1: '#c471ed', color2: '#f64f59' },
  { name: '暗夜蓝',    color1: '#0f2027', color2: '#2c5364' },
  { name: '蜜桃粉',    color1: '#ff9a9e', color2: '#fecfef' },
  { name: '薄荷绿',    color1: '#00b4db', color2: '#0083b0' },
  { name: '灼热橙',    color1: '#ff416c', color2: '#ff4b2b' },
  { name: '酸橙绿',    color1: '#56ab2f', color2: '#a8e063' },
  { name: '霜蓝',     color1: '#000428', color2: '#004e92' },
  { name: '粉紫',     color1: '#ee9ca7', color2: '#ffdde1' },
  { name: '墨绿金',    color1: '#1e9600', color2: '#fff200' },
  { name: '深空紫',    color1: '#654ea3', color2: '#eaafc8' },
  { name: '绯红',     color1: '#ed213a', color2: '#93291e' },
  { name: '碧波',     color1: '#00c6ff', color2: '#0072ff' },
  { name: '沙橙',     color1: '#fdc830', color2: '#f37335' },
  { name: '静夜',     color1: '#0f0c29', color2: '#302b63' },
];

export function useGradient() {
  const [color1, setColor1] = useState('#7ed6cf');
  const [color2, setColor2] = useState('#2c5f6c');
  const [direction, setDirection] = useState<GradientDirection>('tl-br');

  /** Generate matching. Optional c1/c2 overrides avoid stale closure when
   *  generating immediately after a preset change (React batches state). */
  const generate = useCallback(
    (candidates: Candidate[], c1?: string, c2?: string) => {
      const targets = generateTargetColors(c1 ?? color1, c2 ?? color2, direction);
      return solveMinimumCostMatching(targets, candidates);
    },
    [color1, color2, direction]
  );

  const applyPreset = useCallback((preset: GradientPreset) => {
    setColor1(preset.color1);
    setColor2(preset.color2);
  }, []);

  return {
    color1,
    color2,
    direction,
    presets: PRESETS,
    setColor1,
    setColor2,
    setDirection,
    generate,
    applyPreset,
  };
}
