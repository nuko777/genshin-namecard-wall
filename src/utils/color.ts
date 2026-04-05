/** Hex string to RGB tuple. Accepts #RRGGBB and #RGB shorthand. */
export function hexToRGB(hex: string): [number, number, number] {
  // Expand #RGB → #RRGGBB
  if (hex.length === 4) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Interpolate between two RGB tuples at t in [0, 1] */
export function interpolateRGB(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Perceptually-weighted Euclidean color distance.
 *
 * Weights (R×2, G×4, B×3) prioritize green (most luminance-sensitive),
 * then blue, then red. These are intentionally amplified beyond standard
 * luminance weights (≈R×0.3, G×0.59, B×0.11) to produce stronger
 * differentiation between visually-similar namecard colors in the
 * gradient matching algorithm. Empirically tuned for this dataset.
 */
export function colorDistance(a: number[], b: number[]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr * 2 + dg * dg * 4 + db * db * 3);
}
