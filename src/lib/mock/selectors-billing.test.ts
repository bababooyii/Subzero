import { describe, expect, it } from "vitest";
import { lineDiscount, priceDraft } from "../../components/billing/draft";
import { getDb } from "./data";
import { subscriptionTotals } from "./selectors";
import { billingRun, invoiceDetail, invoiceRows, invoiceViewCounts, paymentMethodTotals, paymentRows } from "./selectors-billing";

describe("billing run", () => {
  const drafts = billingRun();
  it("has one draft per due subscription with fresh invoice numbers", () => {
    expect(drafts.length).toBe(14);
    const existing = new Set(getDb().invoices.map((i) => i.number));
    expect(drafts.every((d) => !existing.has(d.invoiceNumber))).toBe(true);
    expect(new Set(drafts.map((d) => d.invoiceNumber)).size).toBe(14);
  });
  it("prices drafts the same as the subscription", () => {
    for (const d of drafts) {
      const sub = getDb().subscriptions.find((s) => s.id === d.subscriptionId)!;
      expect(priceDraft(d.lines)).toEqual(subscriptionTotals(sub));
    }
  });
  it("lists at most three recent invoices per customer, newest first", () => {
    for (const d of drafts) {
      const r = d.context.recentInvoices;
      expect(r.length).toBeLessThanOrEqual(3);
      for (let i = 1; i < r.length; i++) expect(r[i - 1].issueDate >= r[i].issueDate).toBe(true);
    }
  });
  it("applies line discounts and never exceeds the line", () => {
    const l = { ...drafts[0].lines[0], qty: 2, unitPrice: 10000, discountType: "percent" as const, discountValue: 10 };
    expect(lineDiscount(l)).toBe(2000);
    expect(lineDiscount({ ...l, discountType: "fixed", discountValue: 999999 })).toBe(20000);
  });
});

describe("invoice and payment selectors", () => {
  it("views partition the invoices", () => {
    const c = invoiceViewCounts();
    expect(c.draft + c.confirmed + c.paid + c.overdue + c.cancelled).toBe(c.all);
    expect(invoiceRows("overdue").length).toBe(c.overdue);
  });
  it("builds a detail with consistent totals", () => {
    const row = invoiceRows("paid")[0];
    const d = invoiceDetail(row.id)!;
    expect(d.lines.reduce((n, l) => n + l.amount, 0)).toBe(d.subtotal - d.discountTotal);
    expect(invoiceDetail("nope")).toBeNull();
  });
  it("totals payments by method", () => {
    const t = paymentMethodTotals();
    expect(t.methods.reduce((n, m) => n + m.amount, 0)).toBe(t.total);
    expect(paymentRows("all").length).toBe(t.count);
    expect(paymentRows("upi").every((p) => p.method === "upi")).toBe(true);
  });
});
