const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { converter } = require('culori');

const NAMECARDS_FILE = path.join(__dirname, '..', 'public', 'namecards.json');
const CARDS_DIR = path.join(__dirname, '..', 'public', 'cards');

const namecards = JSON.parse(fs.readFileSync(NAMECARDS_FILE, 'utf-8'));
const MIN_ALPHA = 16;
const CONTENT_INSET_RATIO = 0.03;
const MIN_THEME_RATIO = 0.1;
const MAX_THEME_COLORS = 4;
const MIN_COLORFUL_SATURATION = 0.18;
const MIN_COLORFUL_CHROMA = 0.015;
const HUE_BUCKET_COUNT = 9;
const HUE_BUCKET_WIDTH = 360 / HUE_BUCKET_COUNT;
const DOMINANT_SPLIT_MIN_RATIO = 0.85;
const MIN_SPLIT_LIGHTNESS_DISTANCE = 0.25;

const toOklab = converter('oklab');
const toOklch = converter('oklch');
const toHsl = converter('hsl');
const toRgb = converter('rgb');

console.log(`Loaded ${namecards.length} entries`);

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function rgb255ToColor(r, g, b) {
  return { mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 };
}

function rgbToHex(rgb) {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

function normalizeHue(hue) {
  if (!Number.isFinite(hue)) return 0;
  return ((hue % 360) + 360) % 360;
}

function themeBucketKey(rgb) {
  const color = rgb255ToColor(rgb[0], rgb[1], rgb[2]);
  const hsl = toHsl(color) || { h: 0, s: 0, l: 0 };
  const oklch = toOklch(color) || { c: 0 };
  const saturation = clamp01(hsl.s);
  const chroma = Number.isFinite(oklch.c) ? oklch.c : 0;
  // 低饱和/低色度像素的 hue 不稳定，统一收进中性桶，避免灰白阴影被拆成伪彩色主题。
  if (saturation < MIN_COLORFUL_SATURATION || chroma < MIN_COLORFUL_CHROMA) return 'low-color';

  const hue = normalizeHue(hsl.h);
  const shiftedHue = normalizeHue(hue + HUE_BUCKET_WIDTH / 2);
  return `hue-${Math.floor(shiftedHue / HUE_BUCKET_WIDTH)}`;
}

function pixelIndex(image, x, y) {
  return (image.width * y + x) * image.channels;
}

async function readImagePixels(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

function findContentBounds(image) {
  let minX = image.width, maxX = 0, minY = image.height, maxY = 0;

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const idx = pixelIndex(image, x, y);
      if (image.data[idx + 3] >= MIN_ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, maxX, minY, maxY };
}

function clusterCentroid(cluster) {
  return {
    mode: 'oklab',
    l: cluster.l / cluster.weight,
    a: cluster.a / cluster.weight,
    b: cluster.b / cluster.weight,
  };
}

function addSampleToCluster(cluster, sample, weight) {
  cluster.weight += weight;
  cluster.l += sample.oklab.l * weight;
  cluster.a += sample.oklab.a * weight;
  cluster.b += sample.oklab.b * weight;
  cluster.r += sample.rgb[0] * weight;
  cluster.g += sample.rgb[1] * weight;
  cluster.blue += sample.rgb[2] * weight;
  cluster.samples++;
}

function createCluster() {
  return { weight: 0, l: 0, a: 0, b: 0, r: 0, g: 0, blue: 0, samples: 0 };
}

function subtractCluster(total, part) {
  return {
    weight: total.weight - part.weight,
    l: total.l - part.l,
    a: total.a - part.a,
    b: total.b - part.b,
    r: total.r - part.r,
    g: total.g - part.g,
    blue: total.blue - part.blue,
    samples: total.samples - part.samples,
  };
}

function compareSamplesByLightness(a, b) {
  return a.oklab.l - b.oklab.l;
}

function collectBucketSamples(image, bounds, targetBucketKey) {
  const samples = [];
  const cw = bounds.maxX - bounds.minX + 1;
  const inset = Math.round(cw * CONTENT_INSET_RATIO);
  const x1 = bounds.minX + inset;
  const x2 = bounds.maxX - inset;
  const y1 = bounds.minY + inset;
  const y2 = bounds.maxY - inset;

  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const idx = pixelIndex(image, x, y);
      const alpha = image.data[idx + 3];
      if (alpha < MIN_ALPHA) continue;

      const rgb = [image.data[idx], image.data[idx + 1], image.data[idx + 2]];
      if (themeBucketKey(rgb) !== targetBucketKey) continue;

      const oklab = toOklab(rgb255ToColor(rgb[0], rgb[1], rgb[2]));
      if (!oklab) continue;

      samples.push({ rgb, oklab, weight: alpha / 255 });
    }
  }

  return samples;
}

function formatThemeColor(cluster, totalWeight) {
  const oklab = clusterCentroid(cluster);
  const rgbColor = toRgb(oklab) || rgb255ToColor(
    cluster.r / cluster.weight,
    cluster.g / cluster.weight,
    cluster.blue / cluster.weight
  );
  const rgb = [
    Math.round(clamp01(rgbColor.r) * 255),
    Math.round(clamp01(rgbColor.g) * 255),
    Math.round(clamp01(rgbColor.b) * 255),
  ];
  const displayColor = rgb255ToColor(rgb[0], rgb[1], rgb[2]);
  const hsl = toHsl(displayColor) || { h: 0, s: 0, l: 0 };
  const oklch = toOklch(displayColor) || { l: 0, c: 0, h: 0 };

  return {
    rgb,
    hex: rgbToHex(rgb),
    hsl: [
      round(normalizeHue(hsl.h), 1),
      round(clamp01(hsl.s) * 100, 1),
      round(clamp01(hsl.l) * 100, 1),
    ],
    oklch: [
      round(clamp01(oklch.l), 4),
      round(Math.max(0, Number.isFinite(oklch.c) ? oklch.c : 0), 4),
      round(normalizeHue(oklch.h), 1),
    ],
    ratio: round(cluster.weight / totalWeight, 3),
  };
}

function trySplitDominantThemeColorByLightness(samples, dominantCluster, totalWeight) {
  if (!dominantCluster || dominantCluster.weight / totalWeight <= DOMINANT_SPLIT_MIN_RATIO) return null;
  if (samples.length === 0) return null;

  const sortedSamples = [...samples].sort(compareSamplesByLightness);
  if (sortedSamples.length < 2) return null;

  const left = createCluster();
  let bestSplit = null;
  for (let i = 0; i < sortedSamples.length - 1; i++) {
    addSampleToCluster(left, sortedSamples[i], sortedSamples[i].weight);
    if (sortedSamples[i].oklab.l === sortedSamples[i + 1].oklab.l) continue;

    const right = subtractCluster(dominantCluster, left);
    const leftRatio = left.weight / totalWeight;
    const rightRatio = right.weight / totalWeight;
    if (leftRatio <= MIN_THEME_RATIO || rightRatio <= MIN_THEME_RATIO) continue;

    const leftColor = formatThemeColor(left, totalWeight);
    const rightColor = formatThemeColor(right, totalWeight);
    const splitLightnessDistance = Math.abs(leftColor.oklch[0] - rightColor.oklch[0]);
    if (splitLightnessDistance < MIN_SPLIT_LIGHTNESS_DISTANCE) continue;

    const score = splitLightnessDistance * Math.min(leftRatio, rightRatio);
    if (!bestSplit || score > bestSplit.score) {
      bestSplit = { score, colors: [leftColor, rightColor].sort((a, b) => b.ratio - a.ratio) };
    }
  }

  return bestSplit?.colors ?? null;
}

/** 提取名片 top n 主题色，先按低彩色/色相桶聚合，单主色占优时再按 OKLab 明度尝试拆分。 */
function extractThemeColors(image, bounds) {
  const clusterMap = new Map();
  const cw = bounds.maxX - bounds.minX + 1;
  const inset = Math.round(cw * CONTENT_INSET_RATIO);
  const x1 = bounds.minX + inset;
  const x2 = bounds.maxX - inset;
  const y1 = bounds.minY + inset;
  const y2 = bounds.maxY - inset;

  let totalWeight = 0;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const idx = pixelIndex(image, x, y);
      const alpha = image.data[idx + 3];
      if (alpha < MIN_ALPHA) continue;

      const rgb = [image.data[idx], image.data[idx + 1], image.data[idx + 2]];
      const oklab = toOklab(rgb255ToColor(rgb[0], rgb[1], rgb[2]));
      if (!oklab) continue;

      // 主题色占比统一使用可见面积口径，避免灰、黑、低饱和色被彩色权重降权后丢失。
      const weight = alpha / 255;
      const bucketKey = themeBucketKey(rgb);
      const cluster = clusterMap.get(bucketKey) || createCluster();
      addSampleToCluster(cluster, { rgb, oklab }, weight);
      clusterMap.set(bucketKey, cluster);
      totalWeight += weight;
    }
  }

  if (totalWeight <= 0) return [];

  const themeColors = [...clusterMap.values()]
    .filter(cluster => cluster.weight / totalWeight >= MIN_THEME_RATIO)
    .map(cluster => formatThemeColor(cluster, totalWeight))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, MAX_THEME_COLORS);

  const dominantEntry = [...clusterMap.entries()].sort((a, b) => b[1].weight - a[1].weight)[0];
  const dominantBucketKey = dominantEntry?.[0];
  const dominantCluster = dominantEntry?.[1];
  if (themeColors.length === 1 && dominantCluster.weight / totalWeight > DOMINANT_SPLIT_MIN_RATIO) {
    const samples = collectBucketSamples(image, bounds, dominantBucketKey);
    const splitColors = trySplitDominantThemeColorByLightness(samples, dominantCluster, totalWeight);
    if (splitColors) return splitColors;
  }

  return themeColors;
}

async function calcColors(filePath) {
  // 读取/解码异常向上抛出，由 main 计入 failureCount（避免损坏图被静默写空）；
  // 全透明（无内容边界）属合法空结果，返回 [] 不算失败。
  const image = await readImagePixels(filePath);
  const bounds = findContentBounds(image);
  if (!bounds) return { themeColors: [] };
  return { themeColors: extractThemeColors(image, bounds) };
}

async function main() {
  const enrichedNamecards = [];
  let failureCount = 0;
  for (let i = 0; i < namecards.length; i++) {
    const entry = namecards[i];
    const filePath = path.join(CARDS_DIR, entry.hash + '.png');

    if (!fs.existsSync(filePath)) {
      enrichedNamecards.push({ ...entry, themeColors: [] });
      console.log(`FALLBACK [${i + 1}/${namecards.length}] ${entry.name} — file not found: ${entry.hash}.png`);
      continue;
    }

    try {
      const { themeColors } = await calcColors(filePath);
      enrichedNamecards.push({ ...entry, themeColors });
      const state = themeColors.length > 0
        ? themeColors.map(theme => `${theme.hex}/${theme.ratio.toFixed(3)} oklch(${theme.oklch.join(',')})`).join(' | ')
        : 'fallback:no-theme-color';
      console.log(`[${String(i + 1).padStart(3)}/${namecards.length}] ${entry.name.padEnd(20)} ${state}`);
    } catch (e) {
      failureCount++;
      enrichedNamecards.push({ ...entry, themeColors: entry.themeColors ?? [] });
      console.error(`FAIL [${i + 1}/${namecards.length}] ${entry.name}: ${e.message}`);
    }
  }

  if (enrichedNamecards.length !== namecards.length) {
    throw new Error(`Entry count mismatch: ${enrichedNamecards.length}/${namecards.length}`);
  }
  if (failureCount > 0) {
    throw new Error(`Aborting write because ${failureCount} entries failed`);
  }

  const nextJson = JSON.stringify(enrichedNamecards, null, 2);
  JSON.parse(nextJson);

  const tempFile = `${NAMECARDS_FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempFile, nextJson, 'utf-8');
    fs.renameSync(tempFile, NAMECARDS_FILE);
  } catch (e) {
    if (fs.existsSync(tempFile)) fs.rmSync(tempFile);
    throw e;
  }
  console.log(`\nDone! Saved ${enrichedNamecards.length} namecard entries to ${NAMECARDS_FILE}`);
}

main();
