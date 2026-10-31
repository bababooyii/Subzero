import { describe, expect, it } from "vitest";
import { discountAmount, priceLines } from "./pricing";

const taxes = [
  { id: "t18", rate: 18 },
  { id: "t0", rate: 0 },
];

describe("priceLines", () => {
  it("sums lines and applies tax", () => {
    const r = priceLines([{ qty: 2, unitPrice: 100_00, taxId: "t18" }], taxes);
    expect(r).toEqual({ subtotal: 200_00, discountTotal: 0, taxTotal: 36_00, total: 236_00 });
  });

  it("applies a percent discount before tax", () => {
    const r = priceLines(
      [{ qty: 1, unitPrice: 1000_00, taxId: "t18", discountId: "d10" }],
      taxes,
      [{ id: "d10", type: "percent", value: 10 }],
    );
    expect(r.discountTotal).toBe(100_00);
    expect(r.taxTotal).toBe(162_00);
    expect(r.total).toBe(1062_00);
  });

  it("applies a fixed discount and never goes below zero", () => {
    const r = priceLines(
      [{ qty: 1, unitPrice: 50_00, taxId: "t0", discountId: "dx" }],
      taxes,
      [{ id: "dx", type: "fixed", value: 500_00 }],
    );
    expect(r.discountTotal).toBe(50_00);
    expect(r.total).toBe(0);
  });

  it("treats unknown tax as exempt and empty input as zero", () => {
    expect(priceLines([{ qty: 3, unitPrice: 10_00, taxId: "nope" }], taxes).total).toBe(30_00);
    expect(priceLines([], taxes)).toEqual({ subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 });
  });
});

describe("discountAmount", () => {
  it("caps at the base", () => {
    expect(discountAmount(100, { type: "percent", value: 150 })).toBe(100);
  });
});
