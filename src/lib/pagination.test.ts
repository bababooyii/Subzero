import { describe, expect, it } from "vitest";
import { toLimitOffset } from "./pagination";

describe("toLimitOffset", () => {
  it("defaults", () => {
    expect(toLimitOffset({})).toEqual({ limit: 50, offset: 0, page: 1, pageSize: 50 });
    expect(toLimitOffset()).toEqual({ limit: 50, offset: 0, page: 1, pageSize: 50 });
  });
  it("computes offset", () => {
    expect(toLimitOffset({ page: 3, pageSize: 20 })).toEqual({
      limit: 20,
      offset: 40,
      page: 3,
      pageSize: 20,
    });
  });
  it("clamps", () => {
    expect(toLimitOffset({ page: 0 }).page).toBe(1);
    expect(toLimitOffset({ page: -4 }).offset).toBe(0);
    expect(toLimitOffset({ pageSize: 9999 }).pageSize).toBe(200);
    expect(toLimitOffset({ pageSize: -1 }).pageSize).toBe(1);
    expect(toLimitOffset({ page: NaN }).page).toBe(1);
  });
});
