/**
 * Fuzzy match a query against a target string.
 * Characters in the query must appear in order in the target,
 * with gaps allowed between matched characters.
 *
 * Returns a score (higher = better match), or 0 if no match.
 *
 * Scoring heuristics:
 *  - Each matched character contributes base points.
 *  - Consecutive character matches get a bonus.
 *  - Matches at the start of the target or after a separator get a bonus.
 *  - Shorter gaps between matches yield a smaller penalty.
 */
export function fuzzyMatch(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (!q) return 1; // empty query matches everything with neutral score
  if (!t) return 0;

  let score = 0;
  let qi = 0;        // position in query
  let prevTi = -2;   // previous matched position in target (-2 so first match counts as "after gap")
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Base score per matched character
      score += 10;

      // Consecutive bonus (no gap between this and previous matched char in target)
      if (ti === prevTi + 1) {
        consecutive++;
        score += consecutive * 5;
      } else {
        consecutive = 0;
      }

      // Word boundary bonus: match at start or after a separator
      if (ti === 0 || isSeparator(t[ti - 1])) {
        score += 10;
      }

      // Gap penalty: larger gaps reduce score slightly
      if (prevTi >= 0) {
        const gap = ti - prevTi - 1;
        score -= Math.min(gap, 3); // cap penalty at -3 per gap
      }

      prevTi = ti;
      qi++;
    }
  }

  // All query characters must be matched
  if (qi < q.length) return 0;

  // Prefer matches that start earlier in the target
  // (the first matched character position gives a small boost)
  const firstMatchPos = t.indexOf(q[0]);
  if (firstMatchPos >= 0) {
    score -= Math.min(firstMatchPos, 5); // slight penalty for late first match
  }

  return Math.max(score, 1); // ensure positive score for valid matches
}

function isSeparator(ch: string): boolean {
  return /[\s·\-_.,、。，／／]/.test(ch);
}
