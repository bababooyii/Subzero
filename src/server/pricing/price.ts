import { allocate } from "./allocate";

export type PriceLineInput = {
  key: string; // caller's id for the line
  productId: string;
  quantity: number; // integer ≥ 1
  unitPrice: number; // paise (already includes variant extra price)
  taxRatesBps: number[]; // e.g. [1800] for GST 18%; empty = exempt
};

export type DiscountRule = {
  id: string;
  name: string;
  kind: "fixed" | "percent";
  value: number; // paise | bps
  scope: "products" | "subscription";
  productIds: string[];
  minAmount: number | null;
  minQty: number | null;
  startsOn: string | null; // YYYY-MM-DD inclusive
  endsOn: string | null; // YYYY-MM-DD inclusive
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
};

export type PricedLine = {
  key: string;
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  taxRateBps: number;
};

export type RejectReason =
  | "inactive"
  | "not_started"
  | "expired"
  | "used_up"
  | "min_amount"
  | "min_qty"
  | "no_matching_products";

export type PriceResult = {
  lines: PricedLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  applied: { discountId: string; name: string; amount: number }[];
  rejected: { discountId: string; reason: RejectReason }[];
};

function assertInt(n: number, what: string): void {
  if (!Number.isInteger(n)) throw new Error(`price: ${what} must be an integer`);
}

/** round_half_up(n / d) for non-negative integers. */
function divRoundHalfUp(n: number, d: number): number {
  return Math.floor((2 * n + d) / (2 * d));
}

export function price(input: { lines: PriceLineInput[]; discounts: DiscountRule[]; on: string }): PriceResult {
  const { lines, discounts, on } = input;

  for (const l of lines) {
    assertInt(l.quantity, `quantity of line ${l.key}`);
    if (l.quantity < 1) throw new Error(`price: quantity of line ${l.key} must be >= 1`);
    assertInt(l.unitPrice, `unitPrice of line ${l.key}`);
    if (l.unitPrice < 0) throw new Error(`price: unitPrice of line ${l.key} must be >= 0`);
    for (const r of l.taxRatesBps) {
      assertInt(r, `tax rate of line ${l.key}`);
      if (r < 0) throw new Error(`price: tax rate of line ${l.key} must be >= 0`);
    }
  }
  for (const d of discounts) {
    assertInt(d.value, `value of discount ${d.id}`);
    if (d.value < 0) throw new Error(`price: value of discount ${d.id} must be >= 0`);
    if (d.minAmount !== null) assertInt(d.minAmount, `minAmount of discount ${d.id}`);
    if (d.minQty !== null) assertInt(d.minQty, `minQty of discount ${d.id}`);
  }

  const subtotals = lines.map((l) => l.quantity * l.unitPrice);
  const discountByLine = lines.map(() => 0);
  const applied: PriceResult["applied"] = [];
  const rejected: PriceResult["rejected"] = [];

  // products-scope first, then subscription-scope, each in input order (stable).
  const ordered = [
    ...discounts.filter((d) => d.scope === "products"),
    ...discounts.filter((d) => d.scope === "subscription"),
  ];

  for (const d of ordered) {
    const reject = (reason: RejectReason) => rejected.push({ discountId: d.id, reason });

    if (!d.active) { reject("inactive"); continue; }
    if (d.startsOn !== null && on < d.startsOn) { reject("not_started"); continue; }
    if (d.endsOn !== null && on > d.endsOn) { reject("expired"); continue; }
    if (d.usageLimit !== null && d.usedCount >= d.usageLimit) { reject("used_up"); continue; }

    const base: number[] = [];
    lines.forEach((l, i) => {
      if (d.scope === "subscription" || d.productIds.includes(l.productId)) base.push(i);
    });
    if (d.scope === "products" && base.length === 0) { reject("no_matching_products"); continue; }

    const baseSubtotal = base.reduce((s, i) => s + subtotals[i], 0);
    const baseQty = base.reduce((s, i) => s + lines[i].quantity, 0);
    if (d.minAmount !== null && baseSubtotal < d.minAmount) { reject("min_amount"); continue; }
    if (d.minQty !== null && baseQty < d.minQty) { reject("min_qty"); continue; }

    const remaining = base.map((i) => subtotals[i] - discountByLine[i]);
    const remainingTotal = remaining.reduce((a, b) => a + b, 0);
    const raw = d.kind === "percent" ? divRoundHalfUp(baseSubtotal * d.value, 10000) : d.value;
    const amount = Math.min(raw, remainingTotal);
    if (amount <= 0) continue;

    const parts = allocate(amount, remaining);
    base.forEach((lineIdx, k) => {
      discountByLine[lineIdx] += parts[k];
    });
    applied.push({ discountId: d.id, name: d.name, amount });
  }

  const pricedLines: PricedLine[] = lines.map((l, i) => {
    const subtotal = subtotals[i];
    const discount = discountByLine[i];
    const taxable = subtotal - discount;
    const taxRateBps = l.taxRatesBps.reduce((a, b) => a + b, 0);
    const tax = divRoundHalfUp(taxable * taxRateBps, 10000);
    return { key: l.key, subtotal, discount, taxable, tax, total: taxable + tax, taxRateBps };
  });

  const sum = (f: (l: PricedLine) => number) => pricedLines.reduce((s, l) => s + f(l), 0);
  return {
    lines: pricedLines,
    subtotal: sum((l) => l.subtotal),
    discountTotal: sum((l) => l.discount),
    taxTotal: sum((l) => l.tax),
    total: sum((l) => l.total),
    applied,
    rejected,
  };
}
