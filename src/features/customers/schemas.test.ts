import { describe, expect, it } from "vitest";
import { customerInput, GSTIN_REGEX } from "./schemas";

const base = { name: "Asha", email: "Asha@Example.com" };

describe("customerInput", () => {
  it("accepts a minimal customer and normalises email", () => {
    const r = customerInput.parse(base);
    expect(r.email).toBe("asha@example.com");
    expect(r.gstin).toBeUndefined();
  });
  it("accepts a valid GSTIN and uppercases it", () => {
    expect(customerInput.parse({ ...base, gstin: "22aaaaa0000a1z5" }).gstin).toBe("22AAAAA0000A1Z5");
  });
  it.each(["22AAAAA0000A1Z", "22AAAAA0000A1Z55", "AAAAAAA0000A1Z5", "22AAAAA0000A1X5", "22AAAAA0000A0Z5"])(
    "rejects invalid GSTIN %s",
    (gstin) => {
      expect(GSTIN_REGEX.test(gstin)).toBe(false);
      expect(customerInput.safeParse({ ...base, gstin }).success).toBe(false);
    },
  );
  it("rejects bad email and empty name", () => {
    expect(customerInput.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(customerInput.safeParse({ ...base, name: " " }).success).toBe(false);
  });
});
