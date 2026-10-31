import { describe, expect, it } from "vitest";
import { addDays, addInterval, periodEnd, todayIST } from "./dates";

describe("dates", () => {
  it("adds days and weeks", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addInterval("2026-01-01", "daily", 3)).toBe("2026-01-04");
    expect(addInterval("2026-12-28", "weekly", 1)).toBe("2027-01-04");
  });

  it("clamps month ends", () => {
    expect(addInterval("2026-01-31", "monthly", 1)).toBe("2026-02-28");
    expect(addInterval("2028-01-31", "monthly", 1)).toBe("2028-02-29");
    expect(addInterval("2026-03-31", "monthly", 1)).toBe("2026-04-30");
    expect(addInterval("2026-11-30", "monthly", 3)).toBe("2027-02-28");
    expect(addInterval("2026-12-15", "monthly", 1)).toBe("2027-01-15");
  });

  it("handles yearly and leap years", () => {
    expect(addInterval("2028-02-29", "yearly", 1)).toBe("2029-02-28");
    expect(addInterval("2028-02-29", "yearly", 4)).toBe("2032-02-29");
    expect(addInterval("2026-06-10", "yearly", 1)).toBe("2027-06-10");
  });

  it("periodEnd is next start minus one day", () => {
    expect(periodEnd("2026-01-01", "monthly", 1)).toBe("2026-01-31");
    expect(periodEnd("2026-01-31", "monthly", 1)).toBe("2026-02-27");
    expect(periodEnd("2028-02-01", "monthly", 1)).toBe("2028-02-29");
    expect(periodEnd("2026-01-01", "yearly", 1)).toBe("2026-12-31");
    expect(periodEnd("2026-01-01", "weekly", 2)).toBe("2026-01-14");
  });

  it("todayIST uses the Kolkata date", () => {
    // 20:00 UTC on Jan 1 is already Jan 2 in IST.
    expect(todayIST(new Date("2026-01-01T20:00:00Z"))).toBe("2026-01-02");
    expect(todayIST(new Date("2026-01-01T10:00:00Z"))).toBe("2026-01-01");
  });
});
