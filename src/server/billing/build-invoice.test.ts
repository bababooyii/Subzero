import { describe, expect, it } from "vitest";
import type { DiscountRule } from "@/server/pricing";
import { buildInvoice, type BuildInvoiceInput } from "./build-invoice";

const base = (o: Partial<BuildInvoiceInput> = {}): BuildInvoiceInput => ({
  subscription: { id: "s1", number: "SUB-0001" },
  customer: { id: "c1", name: "Acme", email: "a@acme.test", company: "Acme Ltd", address: "1 Road", gstin: "GST1" },
  plan: { interval: "monthly", intervalCount: 1 },
  lines: [
    { productId: "p1", productName: "Seat", variantLabel: "Tier: Pro", quantity: 2, unitPrice: 10000 },
    { productId: "p2", productName: "Support", variantLabel: null, quantity: 1, unitPrice: 5000 },
  ],
  taxesByProduct: { p1: [1800] },
  discounts: [],
  periodStart: "2026-01-31",
  termsDueDays: 15,
  on: "2026-02-01",
  ...o,
});
const disc = (o: Partial<DiscountRule> = {}): DiscountRule => ({
  id: "d1", name: "D1", kind: "percent", value: 1000, scope: "subscription", productIds: [],
  minAmount: null, minQty: null, startsOn: null, endsOn: null, usageLimit: null, usedCount: 0, active: true, ...o,
});

describe("buildInvoice", () => {
  it("builds header dates and customer snapshot", () => {
    const { header } = buildInvoice(base());
    expect(header).toMatchObject({
      subscriptionId: "s1",
      customerId: "c1",
      periodStart: "2026-01-31",
      periodEnd: "2026-02-27", // Jan 31 + 1 month clamps to Feb 28, minus one day
      issuedOn: "2026-02-01",
      dueDate: "2026-02-16",
    });
    expect(header.customerSnapshot).toEqual({
      name: "Acme", email: "a@acme.test", company: "Acme Ltd", address: "1 Road", gstin: "GST1",
    });
  });

  it("snapshots line fields and totals", () => {
    const b = buildInvoice(base());
    expect(b.lines[0]).toEqual({
      productId: "p1", description: "Seat", variantLabel: "Tier: Pro", quantity: 2, unitPrice: 10000,
      taxRateBps: 1800, discountAmount: 0, taxAmount: 3600, lineTotal: 23600,
    });
    expect(b.lines[1]).toMatchObject({ taxRateBps: 0, taxAmount: 0, lineTotal: 5000, variantLabel: null });
    expect(b.header).toMatchObject({ subtotal: 25000, discountTotal: 0, taxTotal: 3600, total: 28600 });
    expect(b.header.total).toBe(b.lines.reduce((s, l) => s + l.lineTotal, 0));
  });

  it("applies discounts and reports them", () => {
    const b = buildInvoice(base({ discounts: [disc()] }));
    expect(b.applied).toEqual([{ discountId: "d1", name: "D1", amount: 2500 }]);
    expect(b.header.discountTotal).toBe(2500);
    expect(b.lines.reduce((s, l) => s + l.discountAmount, 0)).toBe(2500);
    expect(b.header.total).toBe(b.lines.reduce((s, l) => s + l.lineTotal, 0));
  });

  it("reports rejected discounts", () => {
    const b = buildInvoice(base({ discounts: [disc({ active: false })] }));
    expect(b.applied).toEqual([]);
    expect(b.rejected).toEqual([{ discountId: "d1", reason: "inactive" }]);
  });

  it("uses plan interval count for the period end", () => {
    const b = buildInvoice(base({ plan: { interval: "yearly", intervalCount: 1 }, periodStart: "2026-01-01" }));
    expect(b.header.periodEnd).toBe("2026-12-31");
  });
});
