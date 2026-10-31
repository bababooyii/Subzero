import { describe, expect, it } from "vitest";
import { paymentTermInput, planInput, productInput, taxInput, templateInput } from "./schemas";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const product = { name: "CRM", type: "service" as const, salesPrice: 100000, costPrice: 0, taxIds: [], variants: [] };
const plan = {
  name: "Monthly",
  price: 100000,
  interval: "monthly" as const,
  intervalCount: 1,
  minQty: 1,
  availableFrom: "2026-01-10",
  availableTo: null,
  autoClose: false,
  closable: true,
  pausable: true,
  renewable: true,
};
const template = { name: "T", validityDays: 30, planId: uuid, paymentTermId: uuid, lines: [{ productId: uuid, variantId: null, quantity: 1 }] };

describe("productInput", () => {
  it("accepts a valid product with variants", () => {
    const r = productInput.safeParse({
      ...product,
      taxIds: [uuid],
      variants: [{ attribute: "Brand", value: "Odoo", extraPrice: 56000 }],
    });
    expect(r.success).toBe(true);
  });
  it("rejects negative or fractional paise", () => {
    expect(productInput.safeParse({ ...product, salesPrice: -1 }).success).toBe(false);
    expect(productInput.safeParse({ ...product, costPrice: 1.5 }).success).toBe(false);
    expect(
      productInput.safeParse({ ...product, variants: [{ attribute: "a", value: "b", extraPrice: -5 }] }).success,
    ).toBe(false);
  });
  it("enforces name and variant length bounds", () => {
    expect(productInput.safeParse({ ...product, name: "" }).success).toBe(false);
    expect(productInput.safeParse({ ...product, name: "x".repeat(121) }).success).toBe(false);
    expect(
      productInput.safeParse({ ...product, variants: [{ attribute: "x".repeat(61), value: "b", extraPrice: 0 }] }).success,
    ).toBe(false);
  });
  it("rejects bad type, non-uuid taxIds, long notes", () => {
    expect(productInput.safeParse({ ...product, type: "other" }).success).toBe(false);
    expect(productInput.safeParse({ ...product, taxIds: ["x"] }).success).toBe(false);
    expect(productInput.safeParse({ ...product, notes: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("planInput", () => {
  it("accepts open-ended and bounded windows", () => {
    expect(planInput.safeParse(plan).success).toBe(true);
    expect(planInput.safeParse({ ...plan, availableTo: "2026-01-10" }).success).toBe(true);
  });
  it("rejects availableTo before availableFrom", () => {
    const r = planInput.safeParse({ ...plan, availableTo: "2026-01-09" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["availableTo"]);
  });
  it("bounds intervalCount and minQty", () => {
    expect(planInput.safeParse({ ...plan, intervalCount: 0 }).success).toBe(false);
    expect(planInput.safeParse({ ...plan, intervalCount: 36 }).success).toBe(true);
    expect(planInput.safeParse({ ...plan, intervalCount: 37 }).success).toBe(false);
    expect(planInput.safeParse({ ...plan, minQty: 0 }).success).toBe(false);
  });
  it("rejects bad interval, negative price, bad date", () => {
    expect(planInput.safeParse({ ...plan, interval: "hourly" }).success).toBe(false);
    expect(planInput.safeParse({ ...plan, price: -1 }).success).toBe(false);
    expect(planInput.safeParse({ ...plan, availableFrom: "10/01/2026" }).success).toBe(false);
  });
});

describe("taxInput / paymentTermInput", () => {
  it("bounds rateBps 0..10000", () => {
    expect(taxInput.safeParse({ name: "GST", rateBps: 0 }).success).toBe(true);
    expect(taxInput.safeParse({ name: "GST", rateBps: 10000 }).success).toBe(true);
    expect(taxInput.safeParse({ name: "GST", rateBps: 10001 }).success).toBe(false);
    expect(taxInput.safeParse({ name: "GST", rateBps: -1 }).success).toBe(false);
    expect(taxInput.safeParse({ name: "GST", rateBps: 1.5 }).success).toBe(false);
  });
  it("bounds dueDays 0..365", () => {
    expect(paymentTermInput.safeParse({ name: "Immediate", dueDays: 0 }).success).toBe(true);
    expect(paymentTermInput.safeParse({ name: "Net", dueDays: 365 }).success).toBe(true);
    expect(paymentTermInput.safeParse({ name: "Net", dueDays: 366 }).success).toBe(false);
    expect(paymentTermInput.safeParse({ name: "Net", dueDays: -1 }).success).toBe(false);
  });
});

describe("templateInput", () => {
  it("accepts a valid template", () => {
    expect(templateInput.safeParse(template).success).toBe(true);
  });
  it("requires at least one line", () => {
    expect(templateInput.safeParse({ ...template, lines: [] }).success).toBe(false);
  });
  it("bounds quantity and validityDays", () => {
    expect(templateInput.safeParse({ ...template, lines: [{ productId: uuid, variantId: null, quantity: 0 }] }).success).toBe(false);
    expect(templateInput.safeParse({ ...template, validityDays: 0 }).success).toBe(false);
    expect(templateInput.safeParse({ ...template, validityDays: 366 }).success).toBe(false);
  });
});
