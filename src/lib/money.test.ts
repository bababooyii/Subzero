import { describe, expect, it } from "vitest";
import { applyBps, assertPaise, rupeesToPaise, sumPaise } from "./money";

describe("money", () => {
  it("assertPaise rejects non-integers", () => {
    expect(() => assertPaise(10.5)).toThrow();
    expect(() => assertPaise(NaN)).toThrow();
    expect(() => assertPaise(100)).not.toThrow();
  });

  it("rupeesToPaise handles numbers and strings", () => {
    expect(rupeesToPaise(10)).toBe(1000);
    expect(rupeesToPaise("1234.50")).toBe(123450);
    expect(rupeesToPaise("0.1")).toBe(10);
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise("1.005")).toBe(101);
    expect(rupeesToPaise("-2.50")).toBe(-250);
    expect(() => rupeesToPaise("abc")).toThrow();
  });

  it("applyBps rounds half up", () => {
    expect(applyBps(10000, 1800)).toBe(1800);
    expect(applyBps(999, 1800)).toBe(180); // 179.82
    expect(applyBps(1, 5000)).toBe(1); // 0.5 -> 1
    expect(applyBps(1, 4999)).toBe(0);
    expect(applyBps(0, 1800)).toBe(0);
  });

  it("sumPaise adds", () => {
    expect(sumPaise([])).toBe(0);
    expect(sumPaise([100, 250, 5])).toBe(355);
    expect(() => sumPaise([1.5])).toThrow();
  });
});
