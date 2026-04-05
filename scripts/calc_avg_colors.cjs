const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'namecards.json');
const CARDS_DIR = path.join(__dirname, '..', 'public', 'cards');

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

console.log(`Loaded ${config.length} entries`);

/**
 * Find the bounding box of non-transparent pixels in a PNG.
 * Returns { minX, maxX, minY, maxY } or null if fully transparent.
 */
function findContentBounds(png) {
  let minX = png.width, maxX = 0, minY = png.height, maxY = 0;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      if (png.data[idx + 3] >= 16) {
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

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/** Perceptual color distance (weighted Euclidean) */
function colorDistance(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr * dr * 2 + dg * dg * 4 + db * db * 3);
}

/** Compute average [R,G,B] for a rectangular region of a PNG */
function regionAvg(png, x1, x2, y1, y2) {
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const idx = (png.width * y + x) << 2;
      const alpha = png.data[idx + 3];
      if (alpha < 16) continue;
      rSum += png.data[idx] * alpha;
      gSum += png.data[idx + 1] * alpha;
      bSum += png.data[idx + 2] * alpha;
      count += alpha;
    }
  }
  return count > 0
    ? [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)]
    : [0, 0, 0];
}

/**
 * Compute 6-zone colors + variance from the actual content region.
 *
 * Three-stage crop:
 *   1. Bounding-box: find non-transparent pixel extent
 *   2. 3% inset: skip the uniform white decorative border
 *   3. 3×2 grid: divide into 6 equal zones, compute per-zone avg
 *
 * Returns { avgColor, zones, variance }
 */
function calcColors(filePath) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    let pngData = Buffer.alloc(0);
    stream.on('data', chunk => { pngData = Buffer.concat([pngData, chunk]); });
    stream.on('end', () => {
      try {
        const png = PNG.sync.read(pngData);

        // Stage 1: bounding box
        const bounds = findContentBounds(png);
        if (!bounds) {
          resolve({ avgColor: [0,0,0], zones: Array(6).fill([0,0,0]), variance: 0 });
          return;
        }

        // Stage 2: 3% inset (uniform on all 4 sides)
        const cw = bounds.maxX - bounds.minX + 1;
        const inset = Math.round(cw * 0.03);
        const x1 = bounds.minX + inset;
        const x2 = bounds.maxX - inset;
        const y1 = bounds.minY + inset;
        const y2 = bounds.maxY - inset;

        // Stage 3: 3×2 zone grid
        const sampleW = x2 - x1 + 1;
        const sampleH = y2 - y1 + 1;
        const zoneW = Math.floor(sampleW / 3);
        const zoneH = Math.floor(sampleH / 2);

        const zones = [];
        for (let zr = 0; zr < 2; zr++) {
          for (let zc = 0; zc < 3; zc++) {
            const zx1 = x1 + zc * zoneW;
            const zx2 = (zc < 2) ? zx1 + zoneW - 1 : x2;
            const zy1 = y1 + zr * zoneH;
            const zy2 = (zr < 1) ? zy1 + zoneH - 1 : y2;
            zones.push(regionAvg(png, zx1, zx2, zy1, zy2));
          }
        }

        // Overall average (mean of 6 zone averages)
        const avgColor = [
          Math.round(zones.reduce((s, z) => s + z[0], 0) / 6),
          Math.round(zones.reduce((s, z) => s + z[1], 0) / 6),
          Math.round(zones.reduce((s, z) => s + z[2], 0) / 6),
        ];

        // Variance = mean color distance from each zone to overall average
        const variance = zones.reduce((s, z) => s + colorDistance(z, avgColor), 0) / 6;

        resolve({ avgColor, zones, variance: Math.round(variance * 100) / 100 });
      } catch (e) {
        reject(e);
      }
    });
    stream.on('error', reject);
  });
}

// Process sequentially to avoid memory pressure
async function main() {
  for (let i = 0; i < config.length; i++) {
    const entry = config[i];
    const filePath = path.join(CARDS_DIR, entry.hash + '.png');

    if (!fs.existsSync(filePath)) {
      console.log(`SKIP [${i+1}/${config.length}] ${entry.name} — file not found: ${entry.hash}.png`);
      continue;
    }

    try {
      const { avgColor, zones, variance } = await calcColors(filePath);
      entry.avgColor = avgColor;
      entry.zones = zones;
      entry.variance = variance;
      console.log(`[${String(i+1).padStart(3)}/${config.length}] ${entry.name.padEnd(20)} avg: [${avgColor.join(',')}]  var: ${variance.toFixed(1)}`);
    } catch (e) {
      console.error(`FAIL [${i+1}/${config.length}] ${entry.name}: ${e.message}`);
    }
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`\nDone! Saved ${config.length} entries to ${CONFIG_FILE}`);
}

main();
