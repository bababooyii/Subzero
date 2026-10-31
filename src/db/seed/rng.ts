/**
 * Seeded PRNG (mulberry32) plus small helpers. Everything here is pure and
 * deterministic for a given seed. No dependencies.
 */

export type YmdString = string; // "YYYY-MM-DD"
export type IntervalUnit = "day" | "week" | "month" | "year";

export interface Weighted<T> {
  value: T;
  weight: number;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  weighted<T>(items: readonly Weighted<T>[]): T;
  /** Returns a new shuffled array (Fisher-Yates); the input is untouched. */
  shuffle<T>(items: readonly T[]): T[];
  /** True with probability p (0..1). */
  chance(p: number): boolean;
  /** Date between two YYYY-MM-DD strings, both inclusive. */
  date(from: YmdString, to: YmdString): YmdString;
  /** RFC 4122 v4-shaped UUID derived from this stream. */
  uuid(): string;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);

  const int = (min: number, max: number): number => {
    if (max < min) throw new Error(`rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(next() * (max - min + 1));
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("rng.pick: empty array");
    return items[int(0, items.length - 1)] as T;
  };

  const weighted = <T>(items: readonly Weighted<T>[]): T => {
    if (items.length === 0) throw new Error("rng.weighted: empty array");
    const total = items.reduce((sum, i) => sum + i.weight, 0);
    let r = next() * total;
    for (const i of items) {
      r -= i.weight;
      if (r < 0) return i.value;
    }
    return (items[items.length - 1] as Weighted<T>).value;
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  };

  const chance = (p: number): boolean => next() < p;

  const date = (from: YmdString, to: YmdString): YmdString => {
    const span = daysBetween(from, to);
    if (span < 0) throw new Error(`rng.date: ${to} is before ${from}`);
    return addDays(from, int(0, span));
  };

  const uuid = (): string => {
    const b: number[] = [];
    for (let i = 0; i < 16; i++) b.push(int(0, 255));
    b[6] = ((b[6] as number) & 0x0f) | 0x40;
    b[8] = ((b[8] as number) & 0x3f) | 0x80;
    const h = b.map((x) => x.toString(16).padStart(2, "0"));
    return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10, 16).join("")}`;
  };

  return { next, int, pick, weighted, shuffle, chance, date, uuid };
}

// ---------------------------------------------------------------------------
// Local date helpers (UTC, YYYY-MM-DD strings). The real ones will live in
// src/lib/dates.ts; these exist so the seed generator stays dependency-free.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function parseYmd(s: YmdString): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid date string: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function formatYmd(d: Date): YmdString {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: YmdString, days: number): YmdString {
  return formatYmd(new Date(parseYmd(s).getTime() + days * DAY_MS));
}

/** Whole days from a to b (negative when b is before a). */
export function daysBetween(a: YmdString, b: YmdString): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / DAY_MS);
}

/** Adds calendar months, clamping to the last day of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: YmdString, months: number): YmdString {
  const d = parseYmd(s);
  const day = d.getUTCDate();
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return formatYmd(new Date(Date.UTC(year, month, Math.min(day, lastDay))));
}

export function addInterval(s: YmdString, unit: IntervalUnit, count: number): YmdString {
  switch (unit) {
    case "day":
      return addDays(s, count);
    case "week":
      return addDays(s, count * 7);
    case "month":
      return addMonths(s, count);
    case "year":
      return addMonths(s, count * 12);
  }
}
