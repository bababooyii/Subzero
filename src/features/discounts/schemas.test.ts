import { describe, expect, it } from "vitest";
import { discountInput } from "./schemas";

const P = "11111111-1111-4111-8111-111111111111";
const base = { name: "Promo", kind: "percent", value: 1000, scope: "subscription" } as const;

describe("discountInput", () => {
  it("accepts a minimal percent discount and applies defaults", () => {
    const v = discountInput.parse(base);
    expect(v).toMatchObject({ active: true, productIds: [], usageLimit: null });
  });
  it("rejects percent over 100%", () => {
    expect(discountInput.safeParse({ ...base, value: 10001 }).success).toBe(false);
  });
  it("allows fixed values above 10000", () => {
    expect(discountInput.safeParse({ ...base, kind: "fixed", value: 50000 }).success).toBe(true);
  });
  it("requires products when scope is products", () => {
    expect(discountInput.safeParse({ ...base, scope: "products" }).success).toBe(false);
    expect(discountInput.safeParse({ ...base, scope: "products", productIds: [P] }).success).toBe(true);
  });
  it("rejects endsOn before startsOn", () => {
    expect(discountInput.safeParse({ ...base, startsOn: "2026-02-01", endsOn: "2026-01-01" }).success).toBe(false);
  });
});
