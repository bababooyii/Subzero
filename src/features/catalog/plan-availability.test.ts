import { describe, expect, it } from "vitest";
import { isPlanAvailable, unitPriceWithVariant, variantLabel } from "./plan-availability";

describe("isPlanAvailable", () => {
  const plan = { availableFrom: "2026-01-10", availableTo: "2026-01-20" };
  it("is inclusive at both boundaries", () => {
    expect(isPlanAvailable(plan, "2026-01-10")).toBe(true);
    expect(isPlanAvailable(plan, "2026-01-20")).toBe(true);
  });
  it("is false just outside the window", () => {
    expect(isPlanAvailable(plan, "2026-01-09")).toBe(false);
    expect(isPlanAvailable(plan, "2026-01-21")).toBe(false);
  });
  it("is open-ended when availableTo is null", () => {
    const open = { availableFrom: "2026-01-10", availableTo: null };
    expect(isPlanAvailable(open, "2026-01-09")).toBe(false);
    expect(isPlanAvailable(open, "2099-12-31")).toBe(true);
  });
  it("handles a single-day window", () => {
    const one = { availableFrom: "2026-03-05", availableTo: "2026-03-05" };
    expect(isPlanAvailable(one, "2026-03-05")).toBe(true);
    expect(isPlanAvailable(one, "2026-03-06")).toBe(false);
  });
});

describe("variantLabel / unitPriceWithVariant", () => {
  it("formats the label", () => {
    expect(variantLabel("Brand", "Odoo")).toBe("Brand: Odoo");
  });
  it("adds the extra price in paise", () => {
    expect(unitPriceWithVariant(100000, 56000)).toBe(156000);
    expect(unitPriceWithVariant(100000, 0)).toBe(100000);
  });
});
