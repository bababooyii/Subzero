/**
 * Split `total` (integer ≥ 0) across `weights` (integers ≥ 0) pro-rata using the
 * largest-remainder method, so the parts always sum exactly to `total`.
 * Ties on the remainder go to the earlier index. Pure.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (!Number.isInteger(total) || total < 0) throw new Error("allocate: total must be a non-negative integer");
  for (const w of weights) {
    if (!Number.isInteger(w) || w < 0) throw new Error("allocate: weights must be non-negative integers");
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || total === 0) return weights.map(() => 0);
  if (sum === 0) throw new Error("allocate: cannot allocate a positive total over zero weights");

  const parts = weights.map((w) => Math.floor((total * w) / sum));
  const remainders = weights.map((w, i) => ({ i, r: (total * w) % sum }));
  let left = total - parts.reduce((a, b) => a + b, 0);
  remainders.sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of remainders) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}
