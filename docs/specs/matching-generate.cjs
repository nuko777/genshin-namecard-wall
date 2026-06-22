#!/usr/bin/env node
/*
 * 渐变匹配离线生成脚本。
 *
 * 直接复用前端 src/utils/gradient.ts 的 solveDiagonalMatching（同一直接 quality 优化器），
 * 保证线上线下逐位一致；本脚本仅负责 CLI 解析、候选加载与输出，不重复算法实现。
 * 固定方向 tl-br；不读取人工目标 hash。
 */

const { loadTsUtils, REPO_ROOT } = require('./utils/load-ts-utils.cjs');
const fs = require('fs');
const path = require('path');

const NAMECARDS_FILE = path.join(REPO_ROOT, 'public', 'namecards.json');
const DIRECTION = 'tl-br';

function usage() {
  console.log(`Usage:
  node docs/specs/matching-generate.cjs --start <hex> --end <hex>

固定方向 tl-br；输出 clipboard 序列；使用全量预处理数据（始终排除纪行名片，不支持额外筛选）。
`);
}

/** 将 CLI 颜色参数归一化为 computeTargets 使用的 #RRGGBB 格式。 */
function normalizeHexArg(value, optionName) {
  const raw = String(value || '').trim();
  const match = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) throw new Error(`${optionName} 仅支持 RRGGBB 或 #RRGGBB 格式`);
  return `#${match[1].toLowerCase()}`;
}

function parseArgs(argv) {
  const args = { start: null, end: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--start') args.start = argv[++i] || null;
    else if (arg === '--end') args.end = argv[++i] || null;
    else if (arg === '--help') {
      usage();
      process.exit(0);
    }
  }
  if (!args.start || !args.end) throw new Error('必须提供 --start/--end');
  args.start = normalizeHexArg(args.start, '--start');
  args.end = normalizeHexArg(args.end, '--end');
  return args;
}

function loadCandidates(hasThemeColors) {
  const cards = JSON.parse(fs.readFileSync(NAMECARDS_FILE, 'utf-8'));
  // 使用全量预处理数据，仅排除纪行（battlepass）名片并要求存在主题色
  return cards.filter(card => card.theme !== 'battlepass' && hasThemeColors(card));
}

async function main() {
  const gradient = await loadTsUtils('src/utils/gradient.ts');
  const themeColors = await loadTsUtils('src/utils/themeColors.ts');
  const layout = await loadTsUtils('src/utils/layout.ts');
  const args = parseArgs(process.argv);
  const candidates = loadCandidates(themeColors.hasThemeColors);
  const slots = gradient.solveDiagonalMatching(args.start, args.end, DIRECTION, candidates, {});
  console.log(layout.serializeLayout(slots));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
