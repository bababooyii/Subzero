import { describe, expect, it } from "vitest";
import { getDb } from "./data";
import { dashboardKpis, dueForBilling, overdueAgeing, revenueByMonth, revenueByPeriod } from "./selectors";

describe("mock data", () => {
  const db = getDb();
  it("has the expected shape and is deterministic", () => {
    expect(db.customers.length).toBe(40);
    expect(db.products.length).toBe(8);
    expect(db.taxes.length).toBe(4);
    expect(db.plans.length).toBe(6);
    expect(db.templates.length).toBe(3);
    expect(db.discounts.length).toBe(4);
    expect(db.subscriptions.length).toBe(150);
    expect(db.invoices.length).toBeGreaterThan(300);
    expect(db.invoices.length).toBeLessThan(520);
    expect(getDb().invoices[10].total).toBe(db.invoices[10].total);
  });
  it("has 14 subscriptions due today", () => {
    expect(dueForBilling().length).toBe(14);
  });
  it("derives dashboard numbers", () => {
    const k = dashboardKpis();
    expect(k.activeSubscriptions).toBeGreaterThan(50);
    expect(k.overdueCount).toBeGreaterThan(5);
    expect(revenueByMonth().length).toBe(6);
    const a = overdueAgeing();
    expect(a.reduce((n, b) => n + b.count, 0)).toBe(k.overdueCount);
  });
  it("buckets 3 months into six 15-day halves and keeps 6 months monthly", () => {
    const halves = revenueByPeriod(undefined, 3);
    expect(halves.map((h) => h.label)).toEqual(["Aug 1", "Aug 16", "Sep 1", "Sep 16", "Oct 1", "Oct 16"]);
    expect(halves.map((h) => h.range)).toEqual(["Aug 1–15", "Aug 16–31", "Sep 1–15", "Sep 16–30", "Oct 1–15", "Oct 16–31"]);
    const monthly = revenueByMonth(undefined, 3);
    expect(halves[0].invoiced + halves[1].invoiced).toBe(monthly[0].invoiced);
    expect(halves[4].collected + halves[5].collected).toBe(monthly[2].collected);
    expect(revenueByPeriod(undefined, 6).map((p) => p.label)).toEqual(revenueByMonth(undefined, 6).map((m) => m.month));
  });
});
