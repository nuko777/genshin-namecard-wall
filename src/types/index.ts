export type NamecardTheme = '' | 'character' | 'achievement' | 'region' | 'event' | 'battlepass';

export interface Namecard {
  name: string;
  hash: string;
  theme: NamecardTheme;
  region: string;
  element: string;
  /** 主题色列表：按 alpha 加权可见面积占比从高到低排列。 */
  themeColors: Array<{
    rgb: [number, number, number];
    hex: string;
    hsl: [number, number, number];
    oklch: [number, number, number];
    ratio: number;
  }>;
}

export interface FilterState {
  theme: string;
  region: string;
  element: string;
  search: string;
  hideDisabled: boolean;
  /** 是否启用纪行名片（默认关闭，大部分玩家未购买） */
  enableBattlepass: boolean;
}

export interface GradientPreset {
  name: string;
  color1: string;
  color2: string;
}

export type GradientDirection = 'tl-br' | 'tr-bl'; // top-left to bottom-right, top-right to bottom-left
