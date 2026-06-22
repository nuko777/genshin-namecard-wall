import type { GradientDirection } from '../types';

export const GRID_COLS = 4;
export const GRID_ROWS = 4;
export const TOTAL = GRID_COLS * GRID_ROWS;
export const DIAGONAL_COUNT = GRID_COLS + GRID_ROWS - 1;

export function getSlotWeight(slot: number, direction: GradientDirection): number {
  const r = Math.floor(slot / GRID_COLS);
  const c = slot % GRID_COLS;
  return direction === 'tl-br' ? r + c : r + (GRID_COLS - 1 - c);
}

export function buildNeighborPairs(): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const slot = r * GRID_COLS + c;
      if (c < GRID_COLS - 1) pairs.push([slot, slot + 1]);
      if (r < GRID_ROWS - 1) pairs.push([slot, slot + GRID_COLS]);
    }
  }
  return pairs;
}

export const NEIGHBOR_PAIRS = buildNeighborPairs();
