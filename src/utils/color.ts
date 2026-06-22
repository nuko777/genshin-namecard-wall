type RGB = [number, number, number];

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

/** HSL 距离各分量权重；色相主导，饱和度/明度次之。 */
export const HSL_DISTANCE_WEIGHTS = {
  hue: 0.9,
  saturation: 0.45,
  lightness: 0.45,
};

/** Hex string to RGB tuple. Accepts #RRGGBB and #RGB shorthand. */
export function hexToRGB(hex: string): RGB {
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 把 namecards.json 的 HSL 数组 [0-360,0-100,0-100] 归一化为 HSLColor。 */
export function hslColor(hsl: [number, number, number]): HSLColor {
  return { h: hsl[0], s: hsl[1] / 100, l: hsl[2] / 100 };
}

export function rgbToHslColor(rgb: RGB): HSLColor {
  let [r, g, b] = rgb.map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

/** 两个色相的最短夹角（0-180）。 */
export function hueDiffDeg(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** 从 from 到 to 的最短带符号色相增量（-180,180]。 */
export function shortestHueDeltaDeg(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;
  return delta;
}

export function hslDistance(a: HSLColor, b: HSLColor): number {
  // 低饱和颜色的色相不稳定，按双方饱和度门控，避免灰色 hue 主导距离。
  const hueGate = Math.sqrt(Math.max(0, a.s) * Math.max(0, b.s));
  const hue = hueDiffDeg(a.h, b.h) / 180 * hueGate;
  const ds = a.s - b.s;
  const dl = a.l - b.l;
  return Math.sqrt(
    hue * hue * HSL_DISTANCE_WEIGHTS.hue +
    ds * ds * HSL_DISTANCE_WEIGHTS.saturation +
    dl * dl * HSL_DISTANCE_WEIGHTS.lightness
  );
}
