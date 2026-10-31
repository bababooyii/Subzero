import { describe, expect, it } from "vitest";
import { checkPassword, passwordRules } from "./password";

describe("checkPassword", () => {
  it("accepts a strong password", () => {
    expect(checkPassword("Admin@12345")).toEqual({ ok: true, failed: [] });
  });

  it("requires more than 8 characters", () => {
    expect(checkPassword("Abcd@123").failed).toEqual(["length"]);
    expect(checkPassword("Abcd@1234").ok).toBe(true);
  });

  it("reports each failed rule", () => {
    expect(checkPassword("alllowercase1").failed).toEqual([
      "uppercase",
      "special",
    ]);
    expect(checkPassword("ALLUPPER@1234").failed).toEqual(["lowercase"]);
    expect(checkPassword("NoSpecial1234").failed).toEqual(["special"]);
    expect(checkPassword("").failed).toHaveLength(4);
  });

  it("exports rule ids and labels", () => {
    expect(passwordRules.map((r) => r.id)).toEqual([
      "length",
      "uppercase",
      "lowercase",
      "special",
    ]);
    expect(passwordRules.every((r) => r.label.length > 0)).toBe(true);
  });
});
