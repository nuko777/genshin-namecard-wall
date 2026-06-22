#!/usr/bin/env node
/*
 * 渐变匹配独立质量评分脚本。
 *
 * 不再使用人工基准 hash 做拟合度打分（旧的 positionMatches/setMatches 等已移除）。
 * 改为从人工基准排布中学习到的「内在规律」直接评分，与具体 hash 无关：
 *   1. 色相锚定 hueAnchor —— 每格主色绝对贴合该格对角线目标色（最强奖励项）。
 *   2. 梯度贴合 gradientDelta —— 每格主色贴合所在对角线目标色。
 *   3. 邻居平滑 neighborSmooth —— 相邻格主色距离小。
 *   4. 对角线内聚 diagCohesion —— 同对角线主色彼此接近。
 *   5. 对角线色相散度 diagHueSpread —— 同对角线高彩度主色相一致。
 *   6. 杂色惩罚 purityPenalty —— 单卡主题色越纯越好。
 *
 * 三组人工基准仅作为校准夹具（--reference），用同一套独立口径回测，
 * 验证该口径会给人工排布高分；任何模式都不读取前端运行时状态。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadTsUtils, REPO_ROOT } = require('./utils/load-ts-utils.cjs');

const GENERATE_SCRIPT = path.join(REPO_ROOT, 'docs', 'specs', 'matching-generate.cjs');

const NAMECARDS_FILE = path.join(REPO_ROOT, 'public', 'namecards.json');
const utils = {};

// OKLCH 彩度门控：低于该值的主色不参与对角线色相散度统计，避免灰色 hue 噪声
const CHROMA_GATE = 0.04;
// 主题色到目标色距离的质量惩罚权重，与生成口径保持一致
const MASS_PENALTY_WEIGHT = 0.035;

// 独立质量分权重（由人工基准 vs 随机布局校准得到，详见 matching-core.md）
const W_MONO = 40;          // 色相锚定奖励（hueAnchor ∈ [-1,1]）
const W_GRADIENT = 50;      // 梯度贴合惩罚
const W_NEIGHBOR = 22;      // 邻居平滑惩罚
const W_DIAG_COHESION = 30; // 对角线内聚惩罚
const W_DIAG_HUE = 20;      // 对角线色相散度惩罚（已除以 90 归一）
const W_PURITY = 16;        // 杂色惩罚

// 校准夹具：仅用于 --reference 回测，证明独立口径偏好人工排布；不参与任何生成逻辑
const REFERENCE_LAYOUTS = [
  {
    name: '基准1 青绿->蓝紫',
    start: '#83c0b5',
    end: '#8fa0cf',
    hashes: [
      'b3f876e', '7894471', '0bc52ec', '7edf111',
      '4fcc37a', '21c383e', '4d9ea4e', '8e839d5',
      'd1e79fc', 'b618dcd', 'b68b388', '4bed3bc',
      '7b69235', '4a921c0', '87e0192', 'd95ad5c',
    ],
  },
  {
    name: '基准2 黄绿->青绿',
    start: '#96b16c',
    end: '#70adc3',
    hashes: [
      'c98cef6', 'bf975e3', '13f7a38', '4fcc37a',
      '0b196ad', 'bc586e7', 'd1e79fc', '2bffaae',
      'f2a2b9a', 'b3f876e', '0bc52ec', '690e49e',
      '7894471', '21c383e', '3debf97', '0772c89',
    ],
  },
  {
    name: '基准3 紫->蓝',
    start: '#aeaae4',
    end: '#688ecc',
    hashes: [
      '1a923de', '911666e', 'a4bf76e', 'be0ee10',
      '424b985', '0b88110', '52c633f', '381946d',
      'aad6c00', 'a3e3b77', 'd95ad5c', '9b163b8',
      '05021b7', '46122df', 'a9230a2', '444a14f',
    ],
  },
];

// 固定渐变方向为左上->右下，与 matching-generate.cjs 对齐
const DIRECTION = 'tl-br';

// 前端预设方案（与 src/hooks/useGradient.ts 保持一致），用于 --presets 泛化评估
const PRESETS = [
  { name: '朝霞流金', start: '#ca7272', end: '#caca72' },
  { name: '金穗新蕖', start: '#caca72', end: '#72ca72' },
  { name: '林深见海', start: '#72ca72', end: '#72caca' },
  { name: '碧波映天', start: '#72caca', end: '#7272ca' },
  { name: '暮云凝紫', start: '#7272ca', end: '#ca72ca' },
  { name: '紫霞酡红', start: '#ca72ca', end: '#ca7272' },
];

function usage() {
  console.log(`Usage:
  node docs/specs/matching-score.cjs --reference
  node docs/specs/matching-score.cjs --presets
  node docs/specs/matching-score.cjs --clipboard <TVT1:...> --start <hex> --end <hex>

说明：独立质量评分，不依赖人工基准 hash；方向固定 tl-br；布局输入统一为 clipboard 文本（matching-generate.cjs 的输出）。
  --reference 用同一口径回测三组基准排布；
  --presets 对 6 个前端预设方案逐一调用 matching-generate.cjs 生成布局再评分（泛化评估）。
`);
}

function parseArgs(argv) {
  const args = { mode: 'reference', clipboard: null, start: null, end: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--reference') args.mode = 'reference';
    else if (arg === '--presets') args.mode = 'presets';
    else if (arg === '--clipboard') {
      args.mode = 'grid';
      args.clipboard = argv[++i] || '';
    } else if (arg === '--start') args.start = argv[++i] || null;
    else if (arg === '--end') args.end = argv[++i] || null;
    else if (arg === '--help') {
      usage();
      process.exit(0);
    }
  }
  if (args.mode === 'grid' && (!args.start || !args.end)) {
    throw new Error('--clipboard 模式必须提供 --start/--end');
  }
  return args;
}

function loadColorMap() {
  const cards = JSON.parse(fs.readFileSync(NAMECARDS_FILE, 'utf-8'));
  return new Map(cards.map(card => [card.hash, card]));
}

function primaryHsl(colorMap, hash) {
  const theme = utils.primaryTheme(colorMap.get(hash));
  return theme ? utils.hslColor(theme.hsl) : null;
}

/** 每格主色到所在对角线目标色的加权距离均值，越小越贴合渐变。 */
function gradientDelta(grid, colorMap, targets, direction) {
  let sum = 0;
  for (let i = 0; i < utils.TOTAL; i++) {
    const themes = utils.prepareThemeColors(colorMap.get(grid[i]));
    const target = targets[utils.getSlotWeight(i, direction)];
    sum += themes.length ? utils.bestThemeDistance(themes, target, { massPenaltyWeight: MASS_PENALTY_WEIGHT }) : 1;
  }
  return sum / utils.TOTAL;
}

/** 相邻格主色 HSL 距离均值，越小越平滑。 */
function neighborSmooth(grid, colorMap) {
  let sum = 0;
  let count = 0;
  for (const [x, y] of utils.NEIGHBOR_PAIRS) {
    const a = primaryHsl(colorMap, grid[x]);
    const b = primaryHsl(colorMap, grid[y]);
    if (!a || !b) continue;
    sum += utils.hslDistance(a, b);
    count++;
  }
  return count ? sum / count : 0;
}

/** 同对角线主色两两 HSL 距离均值，越小越内聚。 */
function diagCohesion(grid, colorMap, direction) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < utils.TOTAL; i++) {
    for (let j = i + 1; j < utils.TOTAL; j++) {
      if (utils.getSlotWeight(i, direction) !== utils.getSlotWeight(j, direction)) continue;
      const a = primaryHsl(colorMap, grid[i]);
      const b = primaryHsl(colorMap, grid[j]);
      if (!a || !b) continue;
      sum += utils.hslDistance(a, b);
      count++;
    }
  }
  return count ? sum / count : 0;
}

/** 同对角线高彩度主色相差均值（OKLCH hue），越小越一致。 */
function diagHueSpread(grid, colorMap, direction) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < utils.TOTAL; i++) {
    for (let j = i + 1; j < utils.TOTAL; j++) {
      if (utils.getSlotWeight(i, direction) !== utils.getSlotWeight(j, direction)) continue;
      const a = utils.primaryTheme(colorMap.get(grid[i]));
      const b = utils.primaryTheme(colorMap.get(grid[j]));
      if (!a || !b || a.oklch[1] < CHROMA_GATE || b.oklch[1] < CHROMA_GATE) continue;
      sum += utils.hueDiffDeg(a.oklch[2], b.oklch[2]);
      count++;
    }
  }
  return count ? sum / count : 0;
}

/**
 * 色相锚定度：每格主色与该格对角线目标色的平均绝对色相偏差，归一为 [-1,1]。
 * 偏差 0° → 1（完全贴合）；偏差 >= 180° → -1。
 * 用绝对偏差而非相关系数，避免整体平移/缩放色相也能拿满分（相关系数的漏洞）。
 */
function hueAnchor(grid, colorMap, targets, direction) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < utils.TOTAL; i++) {
    const actual = primaryHsl(colorMap, grid[i]);
    if (!actual) continue;
    const target = targets[utils.getSlotWeight(i, direction)];
    sum += utils.hueDiffDeg(actual.h, target.h);
    count++;
  }
  const dev = count ? sum / count : 90;
  return Math.max(-1, 1 - dev / 90);
}

/** 单卡杂色惩罚均值：主色占比、色相熵和簇间跳变的加权和。 */
function purityPenalty(grid, colorMap) {
  let sum = 0;
  let count = 0;
  for (const hash of grid) {
    const themes = utils.prepareThemeColors(colorMap.get(hash));
    if (!themes.length) continue;
    const total = themes.reduce((acc, theme) => acc + theme.ratio, 0) || 1;
    const mainRatio = themes[0].ratio / total;
    const entropy = themes.reduce((acc, theme) => {
      const p = theme.ratio / total;
      return acc + (p > 0 ? -p * Math.log2(p) : 0);
    }, 0);
    const spread = themes.slice(1).reduce((acc, theme) => {
      return acc + utils.hslDistance(themes[0].hsl, theme.hsl) * theme.ratio;
    }, 0);
    sum += (1 - mainRatio) * 0.9 + entropy * 0.25 + spread * 2.2;
    count++;
  }
  return count ? sum / count : 0;
}

function scoreLayout(grid, colorMap, start, end, direction) {
  const targets = utils.computeTargets(start, end);
  const gradient = gradientDelta(grid, colorMap, targets, direction);
  const neighbor = neighborSmooth(grid, colorMap);
  const cohesion = diagCohesion(grid, colorMap, direction);
  const hueSpread = diagHueSpread(grid, colorMap, direction);
  const anchor = hueAnchor(grid, colorMap, targets, direction);
  const purity = purityPenalty(grid, colorMap);

  // 各维度对 quality 的带符号贡献（奖励为正、惩罚为负），便于定位拉低/拉高总分的维度
  const contributions = {
    base: 100,
    hueAnchor: W_MONO * anchor,
    gradientDelta: -W_GRADIENT * gradient,
    neighborSmooth: -W_NEIGHBOR * neighbor,
    diagCohesion: -W_DIAG_COHESION * cohesion,
    diagHueSpread: -W_DIAG_HUE * (hueSpread / 90),
    purityPenalty: -W_PURITY * purity,
  };
  const quality = Object.values(contributions).reduce((sum, value) => sum + value, 0);

  return {
    quality,
    metrics: {
      hueAnchor: anchor,
      gradientDelta: gradient,
      neighborSmooth: neighbor,
      diagCohesion: cohesion,
      diagHueSpread: hueSpread,
      purityPenalty: purity,
    },
    contributions,
  };
}

/** 打印评分结果：综合分 + 各维度原始指标 + 各维度对总分的带符号贡献。 */
function printScore(result) {
  console.log(`quality: ${Number(result.quality.toFixed(4))}`);
  console.log('指标(原始值):');
  for (const [key, value] of Object.entries(result.metrics)) {
    console.log(`  ${key}: ${Number(value.toFixed(4))}`);
  }
  console.log('贡献(对 quality 的加减):');
  for (const [key, value] of Object.entries(result.contributions)) {
    const sign = value >= 0 ? '+' : '';
    console.log(`  ${key}: ${sign}${Number(value.toFixed(4))}`);
  }
}

async function main() {
  Object.assign(utils, await loadTsUtils('src/utils/grid.ts'));
  Object.assign(utils, await loadTsUtils('src/utils/color.ts'));
  Object.assign(utils, await loadTsUtils('src/utils/targets.ts'));
  Object.assign(utils, await loadTsUtils('src/utils/themeColors.ts'));
  Object.assign(utils, await loadTsUtils('src/utils/layout.ts'));
  const args = parseArgs(process.argv);
  const colorMap = loadColorMap();

  if (args.mode === 'reference') {
    REFERENCE_LAYOUTS.forEach(layout => {
      console.log(`\n${layout.name}`);
      printScore(scoreLayout(layout.hashes, colorMap, layout.start, layout.end, DIRECTION));
    });
    return;
  }

  if (args.mode === 'presets') {
    const validHashes = new Set(colorMap.keys());
    PRESETS.forEach(preset => {
      // 调用生成脚本产出 clipboard 布局，保持生成与评分职责分离
      const clipboard = execFileSync('node', [GENERATE_SCRIPT, '--start', preset.start, '--end', preset.end], { encoding: 'utf-8' }).trim();
      const parsed = utils.parseLayout(clipboard, validHashes);
      if (!parsed) throw new Error(`预设 ${preset.name} 生成的布局无法解析：${clipboard}`);
      console.log(`\n${preset.name} ${preset.start}->${preset.end}`);
      printScore(scoreLayout(parsed.slots, colorMap, preset.start, preset.end, DIRECTION));
    });
    return;
  }

  // 布局输入统一为 clipboard 文本，用 parseLayout 解析并按全量名片 hash 校验
  const parsed = utils.parseLayout(args.clipboard, new Set(colorMap.keys()));
  if (!parsed) throw new Error('--clipboard 必须是 TVT1: 前缀 + 16 个逗号分隔 hash 的剪贴板文本');
  printScore(scoreLayout(parsed.slots, colorMap, args.start, args.end, DIRECTION));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
