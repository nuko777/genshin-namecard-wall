import { hexToRGB, interpolateRGB, colorDistance } from './color';
import type { GradientDirection } from '../types';

const GRID_COLS = 4;
const GRID_ROWS = 4;
const TOTAL = GRID_COLS * GRID_ROWS; // 16

// ── Cost normalizers (derived from dataset statistics) ──
// Typical color distance between random namecards: avg=163, p50=159
const GRAD_SCALE = 160;
// Variance distribution: avg=54, std=25, p50=48
const VAR_SCALE = 50;

// ── Cost weights (applied after normalization to ~0-1 scale) ──
const W_GRADIENT = 1.0;   // gradient target match
const W_VARIANCE = 1.2;   // penalty for high-variance cards (uniform preferred)
const W_NEIGHBOR = 1.0;   // smooth transitions between adjacent card edges

// ── Gradient target generation ──

function computeTargets(direction: GradientDirection): number[] {
  const ts: number[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      let t: number;
      if (direction === 'tl-br') {
        t = (r + c) / (GRID_ROWS + GRID_COLS - 2); // (0,0)→0, (3,3)→1
      } else {
        t = (r + (GRID_COLS - 1 - c)) / (GRID_ROWS + GRID_COLS - 2);
      }
      ts.push(clamp(t, 0, 1));
    }
  }
  return ts;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function generateTargetColors(
  color1: string,
  color2: string,
  direction: GradientDirection
): [number, number, number][] {
  const rgb1 = hexToRGB(color1);
  const rgb2 = hexToRGB(color2);
  return computeTargets(direction).map(t => interpolateRGB(rgb1, rgb2, t));
}

// ── Candidate type ──

export interface Candidate {
  hash: string;
  avgColor: number[];
  zones: number[][];   // 6 zones, 3×2 row-major: [0][1][2] / [3][4][5]
  variance: number;
}

// ── Neighbor edge matching ──

/**
 * Zone layout (3 cols × 2 rows):
 *   ┌───┬───┬───┐
 *   │ 0 │ 1 │ 2 │  top row
 *   ├───┼───┼───┤
 *   │ 3 │ 4 │ 5 │  bottom row
 *   └───┴───┴───┘
 */

/** Color distance between bottom edge of `above` and top edge of `current` */
function verticalEdgeCost(above: Candidate, current: Candidate): number {
  // above bottom zones [3,4,5] ↔ current top zones [0,1,2]
  return (
    colorDistance(above.zones[3], current.zones[0]) +
    colorDistance(above.zones[4], current.zones[1]) +
    colorDistance(above.zones[5], current.zones[2])
  ) / 3;
}

/** Color distance between right edge of `left` and left edge of `current` */
function horizontalEdgeCost(left: Candidate, current: Candidate): number {
  // left right zones [2,5] ↔ current left zones [0,3]
  return (
    colorDistance(left.zones[2], current.zones[0]) +
    colorDistance(left.zones[5], current.zones[3])
  ) / 2;
}

// ── Matching ──

type SlotAssignment = { hash: string; candidate: Candidate } | null;

/**
 * Greedy neighbor-aware matching with 2-opt improvement.
 *
 * Processes the 4×4 grid in row-major order. For each slot, scores every
 * remaining candidate by:
 *   1. Gradient fit (overall color vs target)
 *   2. Variance penalty (uniform cards preferred)
 *   3. Neighbor edge smoothness (match above & left edges)
 *
 * Then runs pairwise swap improvement to escape local minima.
 */
export function solveMinimumCostMatching(
  targetColors: [number, number, number][],
  candidates: Candidate[]
): (string | null)[] {
  const n = candidates.length;
  if (n === 0) return Array(TOTAL).fill(null);
  if (n < TOTAL) return candidates.map(c => c.hash); // Not enough — just take all

  // Build a quick lookup
  const candMap = new Map<string, Candidate>();
  candidates.forEach(c => candMap.set(c.hash, c));

  const used = new Set<string>();
  const grid: SlotAssignment[] = Array(TOTAL).fill(null);

  // ── Greedy row-major assignment ──
  for (let slot = 0; slot < TOTAL; slot++) {
    const r = Math.floor(slot / GRID_COLS);
    const c = slot % GRID_COLS;
    const target = targetColors[slot];

    const above = r > 0 ? grid[slot - GRID_COLS] : null;
    const left = c > 0 ? grid[slot - 1] : null;

    let bestHash = '';
    let bestCost = Infinity;

    for (const cand of candidates) {
      if (used.has(cand.hash)) continue;

      // Gradient fit (normalized)
      const gradCost = colorDistance(target, cand.avgColor) / GRAD_SCALE;

      // Variance penalty (normalized)
      const varCost = cand.variance / VAR_SCALE;

      // Neighbor edge cost (normalized)
      let neighborCost = 0;
      if (above) {
        neighborCost += verticalEdgeCost(above.candidate, cand);
      }
      if (left) {
        neighborCost += horizontalEdgeCost(left.candidate, cand);
      }
      if (above || left) {
        neighborCost /= ((above ? 1 : 0) + (left ? 1 : 0)) * GRAD_SCALE;
      }

      const totalCost = gradCost * W_GRADIENT + varCost * W_VARIANCE + neighborCost * W_NEIGHBOR;

      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestHash = cand.hash;
      }
    }

    if (bestHash) {
      used.add(bestHash);
      grid[slot] = { hash: bestHash, candidate: candMap.get(bestHash)! };
    }
  }

  // ── 2-opt pairwise swap improvement (bounded iterations) ──
  let improved = true;
  let iter = 0;
  const MAX_ITER = 200;
  while (improved && iter < MAX_ITER) {
    improved = false;
    iter++;
    for (let s1 = 0; s1 < TOTAL; s1++) {
      for (let s2 = s1 + 1; s2 < TOTAL; s2++) {
        if (!grid[s1] || !grid[s2]) continue;

        const costBefore = slotCost(grid, s1, targetColors) + slotCost(grid, s2, targetColors);

        // Swap
        [grid[s1], grid[s2]] = [grid[s2], grid[s1]];

        const costAfter = slotCost(grid, s1, targetColors) + slotCost(grid, s2, targetColors);

        if (costAfter < costBefore - 1e-6) {
          improved = true;
        } else {
          // Revert
          [grid[s1], grid[s2]] = [grid[s2], grid[s1]];
        }
      }
    }
  }

  return grid.map(g => g?.hash ?? null);
}

/** Compute total cost for a single slot within the current grid context */
function slotCost(
  grid: SlotAssignment[],
  slot: number,
  targetColors: [number, number, number][]
): number {
  const g = grid[slot];
  if (!g) return Infinity;

  const r = Math.floor(slot / GRID_COLS);
  const c = slot % GRID_COLS;

  const gradCost = colorDistance(targetColors[slot], g.candidate.avgColor) / GRAD_SCALE;
  const varCost = g.candidate.variance / VAR_SCALE;

  let neighborCost = 0;
  let nCount = 0;

  const above = r > 0 ? grid[slot - GRID_COLS] : null;
  const left = c > 0 ? grid[slot - 1] : null;
  const below = r < GRID_ROWS - 1 ? grid[slot + GRID_COLS] : null;
  const right = c < GRID_COLS - 1 ? grid[slot + 1] : null;

  if (above) { neighborCost += verticalEdgeCost(above.candidate, g.candidate); nCount++; }
  if (left)  { neighborCost += horizontalEdgeCost(left.candidate, g.candidate); nCount++; }
  if (below) { neighborCost += verticalEdgeCost(g.candidate, below.candidate); nCount++; }
  if (right) { neighborCost += horizontalEdgeCost(g.candidate, right.candidate); nCount++; }

  if (nCount > 0) neighborCost /= nCount * GRAD_SCALE;

  return gradCost * W_GRADIENT + varCost * W_VARIANCE + neighborCost * W_NEIGHBOR;
}
