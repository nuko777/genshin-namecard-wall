import { DIAGONAL_COUNT } from './grid';
import { hexToRGB, rgbToHslColor, shortestHueDeltaDeg, type HSLColor } from './color';

/** 端点插值对称 gamma；>1 让中段更靠近端点性格。 */
export const TARGET_INTERPOLATION_GAMMA = 1.25;

/** 对称 gamma 插值：把 [0,1] 线性进度映射为偏向端点的进度。 */
export function interpolateT(rawT: number): number {
  const left = Math.pow(rawT, TARGET_INTERPOLATION_GAMMA);
  const right = Math.pow(1 - rawT, TARGET_INTERPOLATION_GAMMA);
  return left / (left + right || 1);
}

/** 由起止色生成 7 条对角线的 HSL 目标色（最短色相路径 + S/L 插值）。 */
export function computeTargets(startColorHex: string, endColorHex: string): HSLColor[] {
  const start = rgbToHslColor(hexToRGB(startColorHex));
  const end = rgbToHslColor(hexToRGB(endColorHex));
  const hueDelta = shortestHueDeltaDeg(start.h, end.h);

  return Array.from({ length: DIAGONAL_COUNT }, (_, weight) => {
    const t = interpolateT(weight / (DIAGONAL_COUNT - 1));
    return {
      h: ((start.h + hueDelta * t) % 360 + 360) % 360,
      s: start.s + (end.s - start.s) * t,
      l: start.l + (end.l - start.l) * t,
    };
  });
}
