/** Small helpers for the catalog forms. Money inputs hold rupees as text; the mock data holds paise. */

/** "560" → 56000. Blank or invalid → 0. */
export const toPaise = (s: string): number => {
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/** 56000 → "560". */
export const fromPaise = (paise: number): string => String(paise / 100);

/** A non-negative number typed as text. */
export const isAmount = (s: string): boolean => s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) >= 0;

/** Whole number at or above `min`. */
export const isWhole = (s: string, min = 0): boolean => s.trim() !== "" && Number.isInteger(Number(s)) && Number(s) >= min;

/** Id for a record created in the browser. Call from event handlers, not during render. */
export const localId = (prefix: string): string => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
