import { describe, expect, it } from "vitest";
import { price, type DiscountRule, type PriceLineInput } from "./price";

const line = (o: Partial<PriceLineInput> = {}): PriceLineInput => ({
  key: "a", productId: "p1", quantity: 1, unitPrice: 10000, taxRatesBps: [], ...o,
});
const disc = (o: Partial<DiscountRule> = {}): DiscountRule => ({
  id: "d1", name: "D1", kind: "percent", value: 1000, scope: "subscription", productIds: [],
  minAmount: null, minQty: null, startsOn: null, endsOn: null, usageLimit: null, usedCount: 0, active: true, ...o,
});
const ON = "2026-06-15";

describe("price", () => {
  it("prices lines with no discounts", () => {
    const r = price({ lines: [line({ quantity: 3, unitPrice: 500 })], discounts: [], on: ON });
    expect(r.lines[0]).toMatchObject({ subtotal: 1500, discount: 0, taxable: 1500, tax: 0, total: 1500 });
    expect(r.total).toBe(1500);
    expect(r.applied).toEqual([]);
    expect(r.rejected).toEqual([]);
  });

  it("rounds GST half-up", () => {
    const r = price({ lines: [line({ unitPrice: 333, taxRatesBps: [1800] })], discounts: [], on: ON });
    expect(r.lines[0].tax).toBe(60); // 59.94
    const h = price({ lines: [line({ unitPrice: 25, taxRatesBps: [1000] })], discounts: [], on: ON });
    expect(h.lines[0].tax).toBe(3); // 2.5 -> 3
  });

  it("treats empty tax rates as exempt", () => {
    const r = price({ lines: [line()], discounts: [], on: ON });
    expect(r.lines[0]).toMatchObject({ tax: 0, taxRateBps: 0 });
  });

  it("sums multiple tax rates", () => {
    const r = price({ lines: [line({ taxRatesBps: [900, 900] })], discounts: [], on: ON });
    expect(r.lines[0]).toMatchObject({ taxRateBps: 1800, tax: 1800, total: 11800 });
  });

  it("allocates a percent subscription discount across 3 lines summing exactly", () => {
    const lines = [
      line({ key: "a", unitPrice: 3333 }),
      line({ key: "b", productId: "p2", unitPrice: 3333 }),
      line({ key: "c", productId: "p3", unitPrice: 3334 }),
    ];
    const r = price({ lines, discounts: [disc({ value: 1000 })], on: ON });
    expect(r.applied).toEqual([{ discountId: "d1", name: "D1", amount: 1000 }]);
    expect(r.lines.reduce((s, l) => s + l.discount, 0)).toBe(1000);
    expect(r.discountTotal).toBe(1000);
    expect(r.total).toBe(10000 - 1000);
  });

  it("caps a fixed discount at the subtotal", () => {
    const r = price({ lines: [line({ unitPrice: 500 })], discounts: [disc({ kind: "fixed", value: 99999 })], on: ON });
    expect(r.lines[0]).toMatchObject({ discount: 500, taxable: 0, total: 0 });
    expect(r.applied[0].amount).toBe(500);
  });

  it("products scope only hits matching lines", () => {
    const lines = [line({ key: "a", productId: "p1" }), line({ key: "b", productId: "p2" })];
    const r = price({ lines, discounts: [disc({ scope: "products", productIds: ["p2"], kind: "fixed", value: 700 })], on: ON });
    expect(r.lines[0].discount).toBe(0);
    expect(r.lines[1].discount).toBe(700);
  });

  it("rejects: inactive, not_started, expired, used_up", () => {
    const r = price({
      lines: [line()],
      discounts: [
        disc({ id: "i", active: false }),
        disc({ id: "n", startsOn: "2026-07-01" }),
        disc({ id: "e", endsOn: "2026-06-01" }),
        disc({ id: "u", usageLimit: 5, usedCount: 5 }),
      ],
      on: ON,
    });
    expect(r.rejected).toEqual([
      { discountId: "i", reason: "inactive" },
      { discountId: "n", reason: "not_started" },
      { discountId: "e", reason: "expired" },
      { discountId: "u", reason: "used_up" },
    ]);
    expect(r.discountTotal).toBe(0);
  });

  it("rejects min_amount, min_qty and no_matching_products", () => {
    const r = price({
      lines: [line({ quantity: 2, unitPrice: 1000 })],
      discounts: [
        disc({ id: "a", minAmount: 2001 }),
        disc({ id: "q", minQty: 3 }),
        disc({ id: "m", scope: "products", productIds: ["zzz"] }),
      ],
      on: ON,
    });
    expect(r.rejected).toEqual([
      { discountId: "m", reason: "no_matching_products" },
      { discountId: "a", reason: "min_amount" },
      { discountId: "q", reason: "min_qty" },
    ]);
  });

  it("accepts min_amount / min_qty at the boundary", () => {
    const r = price({ lines: [line({ quantity: 2, unitPrice: 1000 })], discounts: [disc({ minAmount: 2000, minQty: 2 })], on: ON });
    expect(r.applied).toHaveLength(1);
  });

  it("applies at usedCount = limit - 1", () => {
    const r = price({ lines: [line()], discounts: [disc({ usageLimit: 5, usedCount: 4 })], on: ON });
    expect(r.applied).toHaveLength(1);
  });

  it("treats date boundaries as inclusive", () => {
    const d = disc({ startsOn: ON, endsOn: ON });
    expect(price({ lines: [line()], discounts: [d], on: ON }).applied).toHaveLength(1);
    expect(price({ lines: [line()], discounts: [d], on: "2026-06-14" }).rejected[0].reason).toBe("not_started");
    expect(price({ lines: [line()], discounts: [d], on: "2026-06-16" }).rejected[0].reason).toBe("expired");
  });

  it("stacks two discounts, products-scope first", () => {
    const r = price({
      lines: [line({ unitPrice: 10000 })],
      discounts: [
        disc({ id: "sub", kind: "fixed", value: 500 }),
        disc({ id: "prod", scope: "products", productIds: ["p1"], kind: "percent", value: 1000 }),
      ],
      on: ON,
    });
    expect(r.applied.map((a) => a.discountId)).toEqual(["prod", "sub"]);
    expect(r.lines[0].discount).toBe(1500);
  });

  it("caps a later discount at what remains", () => {
    const r = price({
      lines: [line({ unitPrice: 1000 })],
      discounts: [disc({ id: "a", kind: "fixed", value: 800 }), disc({ id: "b", kind: "fixed", value: 800 })],
      on: ON,
    });
    expect(r.applied.map((a) => a.amount)).toEqual([800, 200]);
    expect(r.lines[0].taxable).toBe(0);
  });

  it("prices the Odoo brand variant example (+560 rupees in unit price) with GST and discount", () => {
    // base 1000.00 + 560.00 variant = 1560.00 = 156000 paise, qty 2, 10% off, GST 18%
    const r = price({
      lines: [line({ productId: "crm", quantity: 2, unitPrice: 156000, taxRatesBps: [1800] })],
      discounts: [disc({ value: 1000 })],
      on: ON,
    });
    expect(r.lines[0]).toMatchObject({ subtotal: 312000, discount: 31200, taxable: 280800, tax: 50544, total: 331344 });
  });

  it("is deterministic and does not mutate inputs", () => {
    const input = { lines: [line({ taxRatesBps: [1800] })], discounts: [disc()], on: ON };
    const snapshot = JSON.stringify(input);
    const a = price(input);
    const b = price(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("throws on non-integer money or quantity", () => {
    expect(() => price({ lines: [line({ unitPrice: 10.5 })], discounts: [], on: ON })).toThrow();
    expect(() => price({ lines: [line({ quantity: 1.5 })], discounts: [], on: ON })).toThrow();
    expect(() => price({ lines: [line({ quantity: 0 })], discounts: [], on: ON })).toThrow();
    expect(() => price({ lines: [line()], discounts: [disc({ kind: "fixed", value: 1.5 })], on: ON })).toThrow();
  });
});
