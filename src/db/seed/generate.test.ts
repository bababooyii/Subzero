import { describe, expect, it } from "vitest";
import { generateDataset } from "./generate";
import { addDays, addInterval, addMonths, createRng, daysBetween } from "./rng";

const OPTS = { seed: 42, today: "2026-10-31", customers: 400, subscriptions: 5000 } as const;
const data = generateDataset(OPTS);

describe("rng", () => {
  it("is deterministic per seed and differs across seeds", () => {
    const a = createRng(1), b = createRng(1), c = createRng(2);
    const seqA = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(seqA);
  });

  it("helpers respect bounds", () => {
    const r = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      const d = r.date("2026-01-30", "2026-03-02");
      expect(d >= "2026-01-30" && d <= "2026-03-02").toBe(true);
    }
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(r.weighted([{ value: "x", weight: 0 }, { value: "y", weight: 1 }])).toBe("y");
    expect(r.uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("date helpers", () => {
  it("clamps month ends", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-31", 1)).toBe("2026-11-30");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addInterval("2024-02-29", "year", 1)).toBe("2025-02-28");
    expect(addInterval("2026-10-31", "week", 2)).toBe("2026-11-14");
  });
});

describe("generateDataset", () => {
  it("is deterministic for a seed", () => {
    expect(generateDataset(OPTS)).toEqual(data);
    expect(generateDataset({ ...OPTS, seed: 43 }).subscriptions[0]).not.toEqual(data.subscriptions[0]);
  });

  it("has the expected counts and unique ids", () => {
    expect(data.customers).toHaveLength(400);
    expect(data.subscriptions).toHaveLength(5000);
    expect(data.taxes).toHaveLength(4);
    expect(data.paymentTerms).toHaveLength(3);
    expect(data.products.length).toBeGreaterThanOrEqual(18);
    expect(data.plans).toHaveLength(8);
    expect(data.templates).toHaveLength(4);
    expect(data.discounts).toHaveLength(6);
    const ids = [...data.customers, ...data.subscriptions, ...data.subscriptionLines, ...data.products].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(data.subscriptions.map((s) => s.number)).size).toBe(5000);
    expect(data.subscriptions[0]?.number).toBe("SUB-0001");
    for (let i = 0; i < 5; i++) expect(data.customers[i]?.email).toBe(`customer${i + 1}@brightloop.test`);
  });

  it("matches the status mix", () => {
    const share = (s: string) => data.subscriptions.filter((x) => x.status === s).length / 5000;
    expect(share("active")).toBeCloseTo(0.7, 1);
    expect(share("paused")).toBeCloseTo(0.08, 2);
    expect(share("closed")).toBeCloseTo(0.1, 2);
    for (const s of ["draft", "quotation", "confirmed"]) expect(share(s)).toBeGreaterThan(0.03);
  });

  it("has 1-4 lines per subscription", () => {
    const per = new Map<string, number>();
    for (const l of data.subscriptionLines) per.set(l.subscriptionId, (per.get(l.subscriptionId) ?? 0) + 1);
    expect(per.size).toBe(5000);
    for (const c of per.values()) expect(c >= 1 && c <= 4).toBe(true);
  });

  it("has ~14 active subs due today and no other due-today next dates", () => {
    const due = data.subscriptions.filter((s) => s.nextInvoiceDate === "2026-10-31");
    expect(due).toHaveLength(14);
    expect(due.every((s) => s.status === "active")).toBe(true);
    const overdue = data.subscriptions.filter((s) => s.status === "active" && (s.nextInvoiceDate ?? "") < "2026-10-31");
    expect(overdue).toHaveLength(0);
  });

  it("prices the Odoo variant +56000 over Generic", () => {
    const erp = data.products.find((p) => p.name === "Brightloop ERP")!;
    const vs = data.variants.filter((v) => v.productId === erp.id);
    expect(vs.map((v) => [v.value, v.extraPrice]).sort()).toEqual([["Generic", 0], ["Odoo", 56000]]);
    const lines = data.subscriptionLines.filter((l) => l.productId === erp.id);
    const odoo = lines.find((l) => l.variantId === vs.find((v) => v.value === "Odoo")!.id)!;
    const generic = lines.find((l) => l.variantId === vs.find((v) => v.value === "Generic")!.id)!;
    expect(odoo.unitPrice - generic.unitPrice).toBe(56000);
  });

  it("builds contiguous billing periods with sane totals", () => {
    const bySub = new Map<string, typeof data.billingPeriods>();
    for (const p of data.billingPeriods) bySub.set(p.subscriptionId, [...(bySub.get(p.subscriptionId) ?? []), p]);
    expect(data.billingPeriods.length).toBeGreaterThan(20_000);
    expect(data.billingPeriods.length).toBeLessThan(100_000);
    for (const s of data.subscriptions.slice(0, 1000)) {
      const ps = bySub.get(s.id) ?? [];
      if (["draft", "quotation", "confirmed"].includes(s.status)) expect(ps).toHaveLength(0);
      else {
        expect(ps.length).toBeGreaterThan(0);
        expect(ps[0]?.periodStart).toBe(s.startDate);
      }
      ps.forEach((p, i) => {
        expect(p.periodStart < "2026-10-31").toBe(true);
        expect(daysBetween(p.periodStart, p.periodEnd)).toBeGreaterThanOrEqual(0);
        if (i > 0) expect(p.periodStart).toBe(addDays((ps[i - 1] as typeof p).periodEnd, 1));
      });
      if (s.status === "active") expect(s.nextInvoiceDate).toBe(addDays((ps[ps.length - 1] as { periodEnd: string }).periodEnd, 1));
    }
  });

  it("records one transition per status step", () => {
    const active = data.subscriptions.find((s) => s.status === "active")!;
    const steps = data.statusHistory.filter((h) => h.subscriptionId === active.id).map((h) => h.to);
    expect(steps).toEqual(["quotation", "confirmed", "active"]);
  });

  it("only pauses subscriptions on pausable plans", () => {
    const planById = new Map(data.plans.map((p) => [p.id, p]));
    for (const s of data.subscriptions.filter((x) => x.status === "paused")) expect(planById.get(s.planId)?.canPause).toBe(true);
  });
});
