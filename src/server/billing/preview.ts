import { addInterval } from "@/lib/dates";
import { findDueSubscriptions } from "./due";
import { loadContext } from "./load";
import { buildForPeriod, MAX_PERIODS_PER_RUN } from "./run";
import type { BuiltInvoice } from "./build-invoice";
import type { BillingDeps, DB } from "./types";

export type BillingPreviewRow = {
  subscriptionId: string;
  subscriptionNumber: string;
  number: null; // invoice numbers are only allocated on insert
  customerName: string;
  periodStart: string;
  periodEnd: string;
  lines: BuiltInvoice["lines"];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  appliedDiscounts: BuiltInvoice["applied"];
};

export type BillingPreview = {
  rows: BillingPreviewRow[];
  totals: { count: number; subtotal: number; discountTotal: number; taxTotal: number; total: number };
};

/** Same pricing as runBilling, without inserting anything. */
export async function previewBilling(
  db: DB,
  on: string,
  deps: Pick<BillingDeps, "listApplicableDiscounts">,
): Promise<BillingPreview> {
  const rows: BillingPreviewRow[] = [];
  for (const id of await findDueSubscriptions(db, on)) {
    const ctx = await loadContext(db, id);
    if (!ctx || ctx.lines.length === 0 || !ctx.subscription.nextInvoiceDate) continue;

    let next: string | null = ctx.subscription.nextInvoiceDate;
    for (let i = 0; next && next <= on && i < MAX_PERIODS_PER_RUN; i++) {
      const built = await buildForPeriod(db, ctx, next, on, deps);
      rows.push({
        subscriptionId: id,
        subscriptionNumber: ctx.subscription.number,
        number: null,
        customerName: ctx.customer.name,
        periodStart: built.header.periodStart,
        periodEnd: built.header.periodEnd,
        lines: built.lines,
        subtotal: built.header.subtotal,
        discountTotal: built.header.discountTotal,
        taxTotal: built.header.taxTotal,
        total: built.header.total,
        appliedDiscounts: built.applied,
      });
      next = addInterval(next, ctx.plan.interval, ctx.plan.intervalCount);
      if (ctx.subscription.expiryDate && next > ctx.subscription.expiryDate) next = null;
    }
  }
  const sum = (f: (r: BillingPreviewRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    rows,
    totals: {
      count: rows.length,
      subtotal: sum((r) => r.subtotal),
      discountTotal: sum((r) => r.discountTotal),
      taxTotal: sum((r) => r.taxTotal),
      total: sum((r) => r.total),
    },
  };
}
