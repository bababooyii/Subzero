import { discountAmount } from "../../lib/mock/pricing";
import type { DraftLine } from "@/lib/mock/selectors-billing";
import type { PaymentMethod } from "@/lib/mock/types";

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};

export const INTERVAL_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" } as const;

export const lineGross = (l: Pick<DraftLine, "qty" | "unitPrice">) => Math.round(l.qty * l.unitPrice);

export function lineDiscount(l: DraftLine): number {
  return l.discountType ? discountAmount(lineGross(l), { type: l.discountType, value: l.discountValue }) : 0;
}

export type DraftTotals = { subtotal: number; discountTotal: number; taxTotal: number; total: number };

/** Prices draft lines in integer paise. Tax is on the discounted amount, rounded per line (same rule as priceLines). */
export function priceDraft(lines: DraftLine[]): DraftTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  for (const l of lines) {
    const gross = lineGross(l);
    const off = lineDiscount(l);
    subtotal += gross;
    discountTotal += off;
    taxTotal += Math.round(((gross - off) * l.taxRate) / 100);
  }
  return { subtotal, discountTotal, taxTotal, total: subtotal - discountTotal + taxTotal };
}
