export interface Namecard {
  name: string;
  hash: string;
  theme: 'character' | 'achievement' | 'region' | 'event' | 'other';
  region: string;
  element: string;
  /** Overall average [R, G, B] (deprecated by zones; kept for compat) */
  avgColor: number[];
  /** 6 zone average colors, 3 cols × 2 rows, row-major:
   *  [0][1][2]  (top row)
   *  [3][4][5]  (bottom row) */
  zones: number[][];
  /** Color variance across zones: lower = more uniform = preferred */
  variance: number;
  description: string;
  obtainMethod: string;
}

export interface FilterState {
  theme: string;
  region: string;
  element: string;
  search: string;
  hideDisabled: boolean;
}

export interface GradientPreset {
  name: string;
  color1: string;
  color2: string;
}

export type GradientDirection = 'tl-br' | 'tr-bl'; // top-left to bottom-right, top-right to bottom-left
