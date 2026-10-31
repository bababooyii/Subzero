import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fail, fromZodError, ok } from "./action-result";

describe("action-result", () => {
  it("ok / fail", () => {
    expect(ok(5)).toEqual({ ok: true, data: 5 });
    expect(fail("boom")).toEqual({ ok: false, error: "boom" });
    expect(fail("boom", { a: ["x"] })).toEqual({
      ok: false,
      error: "boom",
      fieldErrors: { a: ["x"] },
    });
  });

  it("fromZodError flattens issues by path", () => {
    const schema = z.object({
      name: z.string().min(2),
      address: z.object({ city: z.string() }),
    });
    const parsed = schema.safeParse({ name: "a", address: {} });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const res = fromZodError(parsed.error);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(Object.keys(res.fieldErrors ?? {}).sort()).toEqual([
      "address.city",
      "name",
    ]);
  });
});
