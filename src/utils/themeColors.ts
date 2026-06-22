import type { Namecard } from '../types';
import { hslColor, hslDistance, type HSLColor } from './color';

type ThemeColor = Namecard['themeColors'][number];

export interface PreparedThemeColor {
  hsl: HSLColor;
  ratio: number;
  hex?: string;
  rgb?: ThemeColor['rgb'];
  oklch?: ThemeColor['oklch'];
}

export interface ThemeMatchOptions {
  massPenaltyWeight?: number;
}

export function getValidThemeColors(card: Pick<Namecard, 'themeColors'> | undefined): ThemeColor[] {
  return [...(card?.themeColors || [])]
    .filter(theme => theme.ratio > 0 && theme.hsl.length === 3)
    .sort((a, b) => b.ratio - a.ratio);
}

export function hasThemeColors(card: Pick<Namecard, 'themeColors'>): boolean {
  return getValidThemeColors(card).length > 0;
}

export function prepareThemeColors(card: Pick<Namecard, 'themeColors'> | undefined): PreparedThemeColor[] {
  return getValidThemeColors(card).map(theme => ({
    hsl: hslColor(theme.hsl),
    ratio: theme.ratio,
    hex: theme.hex,
    rgb: theme.rgb,
    oklch: theme.oklch,
  }));
}

export function primaryTheme(card: Pick<Namecard, 'themeColors'> | undefined): ThemeColor | null {
  return getValidThemeColors(card)[0] || null;
}

export function uniqueByHash<T extends { hash: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (seen.has(item.hash)) continue;
    seen.add(item.hash);
    unique.push(item);
  }
  return unique;
}

export function bestThemeForTarget(
  colors: PreparedThemeColor[],
  target: HSLColor,
  options: ThemeMatchOptions = {}
): PreparedThemeColor {
  let best = colors[0];
  let bestCost = Infinity;
  const massPenaltyWeight = options.massPenaltyWeight || 0;
  for (const color of colors) {
    const distance = hslDistance(color.hsl, target);
    const massPenalty = (1 - color.ratio) * massPenaltyWeight;
    const cost = distance + massPenalty;
    if (cost < bestCost) {
      bestCost = cost;
      best = color;
    }
  }
  return best;
}

/** 返回卡片主题色到目标色的最小加权距离（含质量惩罚）；无主题色时返回 1。 */
export function bestThemeDistance(
  colors: PreparedThemeColor[],
  target: HSLColor,
  options: ThemeMatchOptions = {}
): number {
  if (!colors.length) return 1;
  const best = bestThemeForTarget(colors, target, options);
  return hslDistance(best.hsl, target) + (1 - best.ratio) * (options.massPenaltyWeight || 0);
}
