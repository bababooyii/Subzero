import { describe, expect, it } from "vitest";
import { allocate } from "./allocate";

describe("allocate", () => {
  it("splits evenly when divisible", () => {
    expect(allocate(300, [100, 100, 100])).toEqual([100, 100, 100]);
  });
  it("sums exactly with largest remainder", () => {
    const parts = allocate(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });
  it("is pro-rata to weights", () => {
    expect(allocate(1000, [1, 3])).toEqual([250, 750]);
  });
  it("gives the extra unit to the largest remainder", () => {
    // exact: 0.5*... total 5 over [1,2] -> 1.67, 3.33 -> floor 1,3 -> extra to first (0.67)
    expect(allocate(5, [1, 2])).toEqual([2, 3]);
  });
  it("returns zeros for total 0 or empty weights", () => {
    expect(allocate(0, [5, 5])).toEqual([0, 0]);
    expect(allocate(0, [])).toEqual([]);
  });
  it("never gives weight-0 entries anything", () => {
    expect(allocate(7, [0, 5, 0, 5])).toEqual([0, 4, 0, 3]);
  });
  it("throws on bad input", () => {
    expect(() => allocate(1.5, [1])).toThrow();
    expect(() => allocate(-1, [1])).toThrow();
    expect(() => allocate(5, [0, 0])).toThrow();
    expect(() => allocate(5, [1.2])).toThrow();
  });
});
