import type { Discount, SubscriptionLine, Tax } from "./types";

export type PricedTotals = {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
};

/** Discount amount for a base value (paise). Never exceeds the base. */
export function discountAmount(base: number, discount: Pick<Discount, "type" | "value">): number {
  const raw = discount.type === "percent" ? Math.round((base * discount.value) / 100) : discount.value;
  return Math.max(0, Math.min(base, raw));
}

/**
 * Prices subscription lines in integer paise.
 * A line's own `discountId` discounts that line; the first matching discount applies per line.
 * Tax is computed on the discounted amount, rounded per line.
 */
export function priceLines(
  lines: Pick<SubscriptionLine, "qty" | "unitPrice" | "taxId" | "discountId">[],
  taxes: Pick<Tax, "id" | "rate">[],
  discounts: Pick<Discount, "id" | "type" | "value">[] = [],
): PricedTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    const gross = Math.round(line.qty * line.unitPrice);
    const discount = line.discountId ? discounts.find((d) => d.id === line.discountId) : undefined;
    const off = discount ? discountAmount(gross, discount) : 0;
    const rate = taxes.find((t) => t.id === line.taxId)?.rate ?? 0;
    subtotal += gross;
    discountTotal += off;
    taxTotal += Math.round(((gross - off) * rate) / 100);
  }
  return { subtotal, discountTotal, taxTotal, total: subtotal - discountTotal + taxTotal };
}
