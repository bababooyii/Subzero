/** Money is always an integer number of paise (minor units). No formatting here. */
export type Paise = number;

export function assertPaise(n: number): asserts n is Paise {
  if (!Number.isSafeInteger(n)) {
    throw new Error(`Expected integer paise, got ${n}`);
  }
}

/** Convert rupees (number or "1234.50" string) to paise, rounding half up. */
export function rupeesToPaise(r: number | string): Paise {
  const str = typeof r === "number" ? r.toString() : r.trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid rupee amount: ${r}`);
  }
  const negative = str.startsWith("-");
  const [whole, frac = ""] = str.replace("-", "").split(".");
  const padded = (frac + "000").slice(0, 3);
  let paise = Number(whole) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) paise += 1;
  const result = negative ? -paise : paise;
  assertPaise(result);
  return result;
}

/** amount * bps / 10000, rounded half up (away from zero for negatives). */
export function applyBps(amount: Paise, bps: number): Paise {
  assertPaise(amount);
  assertPaise(bps);
  const product = amount * bps;
  const abs = Math.floor((Math.abs(product) + 5000) / 10000);
  const result = product < 0 ? -abs : abs;
  return result === 0 ? 0 : result;
}

export function sumPaise(values: readonly Paise[]): Paise {
  let total = 0;
  for (const v of values) {
    assertPaise(v);
    total += v;
  }
  assertPaise(total);
  return total;
}
