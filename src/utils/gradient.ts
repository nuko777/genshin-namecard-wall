import type { GradientDirection, Namecard } from '../types';
import { hslColor, hslDistance, hueDiffDeg, type HSLColor } from './color';
import { computeTargets } from './targets';
import { NEIGHBOR_PAIRS, TOTAL, getSlotWeight } from './grid';
import { hasThemeColors, prepareThemeColors, primaryTheme, uniqueByHash, bestThemeDistance } from './themeColors';

type ThemeColor = Namecard['themeColors'][number];

export interface Candidate {
  hash: string;
  themeColors: ThemeColor[];
}

export type LockedSlots = Partial<Record<number, string>>;

export { getSlotWeight } from './grid';

// 评分口径常量，必须与 docs/specs/matching-score.cjs 完全一致
const CHROMA_GATE = 0.04;
const MASS_PENALTY_WEIGHT = 0.035;
const W_MONO = 40;
const W_GRADIENT = 50;
const W_NEIGHBOR = 22;
const W_DIAG_COHESION = 30;
const W_DIAG_HUE = 20;
const W_PURITY = 16;

// 优化器参数
const RESTARTS = 8;        // 随机重启次数（含 1 次贪心初始化）
const HILL_ITERATIONS = 400;
const RNG_SEED = 0x9e3779b9;

/** 候选卡的评分相关预计算量。 */
interface Prepared {
  hash: string;
  prim: HSLColor | null;
  oklch: ThemeColor['oklch'] | null;
  gd: number[]; // 到每条对角线目标色的最佳主题色加权距离
  purity: number;
}

/** 当前方向下的几何信息：每槽对角线权重 + 每条对角线的槽位分组。 */
interface Geometry {
  slotWeight: number[];
  diagGroups: number[][];
}

function buildGeometry(direction: GradientDirection): Geometry {
  const slotWeight = Array.from({ length: TOTAL }, (_, slot) => getSlotWeight(slot, direction));
  const count = Math.max(...slotWeight) + 1;
  const diagGroups: number[][] = Array.from({ length: count }, () => []);
  for (let slot = 0; slot < TOTAL; slot++) diagGroups[slotWeight[slot]].push(slot);
  return { slotWeight, diagGroups };
}

/** 确定性 PRNG，保证同输入稳定可复现。 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prepareCandidate(cand: Candidate, targets: HSLColor[]): Prepared {
  const themes = prepareThemeColors(cand);
  const primary = primaryTheme(cand);
  const prim = primary ? hslColor(primary.hsl) : null;
  const oklch = primary ? primary.oklch : null;
  const gd = targets.map(target => bestThemeDistance(themes, target, { massPenaltyWeight: MASS_PENALTY_WEIGHT }));
  const total = themes.reduce((sum, theme) => sum + theme.ratio, 0) || 1;
  const mainRatio = themes.length ? themes[0].ratio / total : 0;
  const entropy = themes.reduce((sum, theme) => {
    const p = theme.ratio / total;
    return sum + (p > 0 ? -p * Math.log2(p) : 0);
  }, 0);
  const spread = themes.slice(1).reduce((sum, theme) => sum + hslDistance(themes[0].hsl, theme.hsl) * theme.ratio, 0);
  const purity = (1 - mainRatio) * 0.9 + entropy * 0.25 + spread * 2.2;
  return { hash: cand.hash, prim, oklch, gd, purity };
}

/** 计算 16 格布局的 quality，口径与 matching-score.cjs 完全一致。 */
function quality(grid: Prepared[], targets: HSLColor[], geom: Geometry): number {
  const { slotWeight, diagGroups } = geom;

  let gradient = 0;
  for (let i = 0; i < TOTAL; i++) gradient += grid[i].gd[slotWeight[i]];
  gradient /= TOTAL;

  let neighbor = 0;
  let neighborCount = 0;
  for (const [x, y] of NEIGHBOR_PAIRS) {
    if (!grid[x].prim || !grid[y].prim) continue;
    neighbor += hslDistance(grid[x].prim!, grid[y].prim!);
    neighborCount++;
  }
  neighbor = neighborCount ? neighbor / neighborCount : 0;

  let cohesion = 0;
  let cohesionCount = 0;
  let hueSpread = 0;
  let hueSpreadCount = 0;
  for (const group of diagGroups) {
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        const ca = grid[group[a]];
        const cb = grid[group[b]];
        if (ca.prim && cb.prim) {
          cohesion += hslDistance(ca.prim, cb.prim);
          cohesionCount++;
        }
        if (ca.oklch && cb.oklch && ca.oklch[1] >= CHROMA_GATE && cb.oklch[1] >= CHROMA_GATE) {
          hueSpread += hueDiffDeg(ca.oklch[2], cb.oklch[2]);
          hueSpreadCount++;
        }
      }
    }
  }
  cohesion = cohesionCount ? cohesion / cohesionCount : 0;
  hueSpread = hueSpreadCount ? hueSpread / hueSpreadCount : 0;

  // 色相锚定：每格主色与该格目标色的平均绝对色相偏差，归一为 [-1,1]
  let hueDevSum = 0;
  let hueDevCount = 0;
  for (let i = 0; i < TOTAL; i++) {
    if (!grid[i].prim) continue;
    hueDevSum += hueDiffDeg(grid[i].prim!.h, targets[slotWeight[i]].h);
    hueDevCount++;
  }
  const anchor = Math.max(-1, 1 - (hueDevCount ? hueDevSum / hueDevCount : 90) / 90);

  let purity = 0;
  for (let i = 0; i < TOTAL; i++) purity += grid[i].purity;
  purity /= TOTAL;

  return (
    100 +
    W_MONO * anchor -
    W_GRADIENT * gradient -
    W_NEIGHBOR * neighbor -
    W_DIAG_COHESION * cohesion -
    W_DIAG_HUE * (hueSpread / 90) -
    W_PURITY * purity
  );
}

/**
 * 贪心初始化：按对角线权重顺序，每个自由槽取目标距离最小且未用的卡。
 * 锁定槽直接放入对应卡，并占用其 hash。
 */
function greedyInit(prepared: Prepared[], geom: Geometry, locked: Map<number, Prepared>): Prepared[] {
  const grid = new Array<Prepared>(TOTAL);
  const used = new Set<string>();
  for (const [slot, card] of locked) {
    grid[slot] = card;
    used.add(card.hash);
  }
  const freeSlots = Array.from({ length: TOTAL }, (_, slot) => slot)
    .filter(slot => !locked.has(slot))
    .sort((a, b) => geom.slotWeight[a] - geom.slotWeight[b]);
  for (const slot of freeSlots) {
    let best: Prepared | null = null;
    let bestCost = Infinity;
    for (const card of prepared) {
      if (used.has(card.hash)) continue;
      const cost = card.gd[geom.slotWeight[slot]];
      if (cost < bestCost) {
        bestCost = cost;
        best = card;
      }
    }
    // 候选耗尽（候选不足 16）时留空槽，由调用方兜底为 null
    if (!best) break;
    grid[slot] = best;
    used.add(best.hash);
  }
  return grid;
}

/** 随机初始化：锁定槽固定，自由槽从未锁定候选中随机取。 */
function randomInit(prepared: Prepared[], locked: Map<number, Prepared>, rng: () => number): Prepared[] {
  const grid = new Array<Prepared>(TOTAL);
  const used = new Set<string>();
  for (const [slot, card] of locked) {
    grid[slot] = card;
    used.add(card.hash);
  }
  const freeSlots = Array.from({ length: TOTAL }, (_, slot) => slot).filter(slot => !locked.has(slot));
  const free = prepared.filter(card => !used.has(card.hash));
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  freeSlots.forEach((slot, i) => {
    grid[slot] = free[i];
  });
  return grid;
}

/**
 * 爬山：交换两个自由槽 + 用池中卡替换某个自由槽，最大化 quality。
 * 锁定槽不参与交换/替换；就地修改 grid/pool，返回最终分。
 */
function hillClimb(
  grid: Prepared[],
  pool: Prepared[],
  targets: HSLColor[],
  geom: Geometry,
  lockedSet: Set<number>
): number {
  const freeSlots = Array.from({ length: TOTAL }, (_, slot) => slot).filter(slot => !lockedSet.has(slot));
  let current = quality(grid, targets, geom);
  const EPS = 1e-9;
  for (let iteration = 0; iteration < HILL_ITERATIONS; iteration++) {
    let bestDelta = EPS;
    let move: { type: 'swap'; i: number; j: number; q: number } | { type: 'replace'; i: number; p: number; q: number } | null = null;

    for (let ai = 0; ai < freeSlots.length; ai++) {
      for (let bi = ai + 1; bi < freeSlots.length; bi++) {
        const i = freeSlots[ai];
        const j = freeSlots[bi];
        const tmp = grid[i];
        grid[i] = grid[j];
        grid[j] = tmp;
        const q = quality(grid, targets, geom);
        grid[j] = grid[i];
        grid[i] = tmp;
        if (q - current > bestDelta) {
          bestDelta = q - current;
          move = { type: 'swap', i, j, q };
        }
      }
    }

    for (const i of freeSlots) {
      const orig = grid[i];
      for (let p = 0; p < pool.length; p++) {
        grid[i] = pool[p];
        const q = quality(grid, targets, geom);
        if (q - current > bestDelta) {
          bestDelta = q - current;
          move = { type: 'replace', i, p, q };
        }
      }
      grid[i] = orig;
    }

    if (!move) break;
    if (move.type === 'swap') {
      const tmp = grid[move.i];
      grid[move.i] = grid[move.j];
      grid[move.j] = tmp;
    } else {
      const out = grid[move.i];
      grid[move.i] = pool[move.p];
      pool[move.p] = out;
    }
    current = move.q;
  }
  return current;
}

export function solveDiagonalMatching(
  startColorHex: string,
  endColorHex: string,
  direction: GradientDirection,
  candidates: Candidate[],
  lockedSlots: LockedSlots = {}
): (string | null)[] {
  if (candidates.length === 0) return Array(TOTAL).fill(null);

  const targets = computeTargets(startColorHex, endColorHex);
  const geom = buildGeometry(direction);
  const unique = uniqueByHash(candidates.filter(hasThemeColors));
  if (unique.length === 0) return Array(TOTAL).fill(null);

  const prepared = unique.map(cand => prepareCandidate(cand, targets));
  const prepMap = new Map(prepared.map(p => [p.hash, p]));

  // 校验锁定槽：槽位合法、hash 存在于候选、去重
  const locked = new Map<number, Prepared>();
  const lockedHashes = new Set<string>();
  for (const [slotKey, hash] of Object.entries(lockedSlots)) {
    const slot = Number(slotKey);
    if (!Number.isInteger(slot) || slot < 0 || slot >= TOTAL) continue;
    if (!hash || lockedHashes.has(hash)) continue;
    const card = prepMap.get(hash);
    if (!card) continue;
    locked.set(slot, card);
    lockedHashes.add(hash);
  }

  // 候选不足时退化为单次贪心
  if (prepared.length < TOTAL) {
    return greedyInit(prepared, geom, locked).slice(0, TOTAL).map(card => (card ? card.hash : null));
  }

  const lockedSet = new Set(locked.keys());
  const rng = mulberry32(RNG_SEED);
  let bestGrid: (string | null)[] | null = null;
  let bestQuality = -Infinity;
  for (let restart = 0; restart < RESTARTS; restart++) {
    const grid = restart === 0 ? greedyInit(prepared, geom, locked) : randomInit(prepared, locked, rng);
    const inGrid = new Set(grid.map(card => card.hash));
    const pool = prepared.filter(card => !inGrid.has(card.hash));
    const q = hillClimb(grid, pool, targets, geom, lockedSet);
    if (q > bestQuality) {
      bestQuality = q;
      bestGrid = grid.map(card => card.hash);
    }
  }
  return bestGrid!;
}
