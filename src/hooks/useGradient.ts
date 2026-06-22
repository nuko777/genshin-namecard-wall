import { useState, useCallback, useRef, useEffect } from 'react';
import { solveDiagonalMatching } from '../utils/gradient';
import type { Candidate, LockedSlots } from '../utils/gradient';
import type { GradientPreset, GradientDirection } from '../types';

const PRESETS: GradientPreset[] = [
  // ── 6 个预设：沿 HSL 色相环每 60° 取一对，中低饱和度 (S≈45%, L≈62%) ──
  { name: '朝霞流金', color1: '#ca7272', color2: '#caca72' }, // 红→黄  H0   → H60
  { name: '金穗新蕖', color1: '#caca72', color2: '#72ca72' }, // 黄→绿  H60  → H120
  { name: '林深见海', color1: '#72ca72', color2: '#72caca' }, // 绿→青  H120 → H180
  { name: '碧波映天', color1: '#72caca', color2: '#7272ca' }, // 青→蓝  H180 → H240
  { name: '暮云凝紫', color1: '#7272ca', color2: '#ca72ca' }, // 蓝→紫  H240 → H300
  { name: '紫霞酡红', color1: '#ca72ca', color2: '#ca7272' }, // 紫→红  H300 → H360
];

const DEFAULT_PRESET = PRESETS[0];
// 拾色器拖动去抖延迟（毫秒）：显示色即时更新，重排在停手后触发
const COLOR_COMMIT_DELAY = 250;

export function useGradient() {
  // 显示色：渐变条与拾色器即时跟随
  const [color1, setColor1] = useState(DEFAULT_PRESET.color1);
  const [color2, setColor2] = useState(DEFAULT_PRESET.color2);
  // 提交色：实际喂给生成算法，拾色器变更时去抖滞后于显示色
  const [genColor1, setGenColor1] = useState(DEFAULT_PRESET.color1);
  const [genColor2, setGenColor2] = useState(DEFAULT_PRESET.color2);
  const [direction, setDirection] = useState<GradientDirection>('tl-br');
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelCommit = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  // 卸载时清理待触发的去抖定时器
  useEffect(() => cancelCommit, [cancelCommit]);

  /** 拾色器拖动：显示色即时更新，提交色去抖，避免高频重排。 */
  const changeColor1 = useCallback((color: string) => {
    setColor1(color);
    cancelCommit();
    commitTimerRef.current = setTimeout(() => setGenColor1(color), COLOR_COMMIT_DELAY);
  }, [cancelCommit]);

  const changeColor2 = useCallback((color: string) => {
    setColor2(color);
    cancelCommit();
    commitTimerRef.current = setTimeout(() => setGenColor2(color), COLOR_COMMIT_DELAY);
  }, [cancelCommit]);

  /** 即时提交起点色（预设/填充模式端点等离散操作，不去抖）。 */
  const commitColor1 = useCallback((color: string) => {
    cancelCommit();
    setColor1(color);
    setGenColor1(color);
  }, [cancelCommit]);

  const commitColor2 = useCallback((color: string) => {
    cancelCommit();
    setColor2(color);
    setGenColor2(color);
  }, [cancelCommit]);

  /** 用当前提交色与方向匹配名片，返回 16 槽位 hash。 */
  const generate = useCallback(
    (candidates: Candidate[], lockedSlots?: LockedSlots) => {
      return solveDiagonalMatching(genColor1, genColor2, direction, candidates, lockedSlots);
    },
    [genColor1, genColor2, direction]
  );

  const applyPreset = useCallback((preset: GradientPreset) => {
    commitColor1(preset.color1);
    commitColor2(preset.color2);
  }, [commitColor1, commitColor2]);

  return {
    color1,
    color2,
    direction,
    presets: PRESETS,
    changeColor1,
    changeColor2,
    commitColor1,
    commitColor2,
    setDirection,
    generate,
    applyPreset,
  };
}
