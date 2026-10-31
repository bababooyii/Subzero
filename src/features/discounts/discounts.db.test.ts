import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { discountRedemptions, discounts } from "@/db/schema";
import { listActivity } from "@/server/activity-log";
import { makeInvoice, makePlan, makeProduct, makeSubscription, makeUser } from "@/server/state-machine/fixtures";
import { testDb, truncateAll } from "@/test/db";
import { getDiscount, listApplicableDiscounts, listDiscounts } from "./queries";
import { archiveDiscount, createDiscount, DiscountError, redeemDiscounts, updateDiscount } from "./service";

beforeEach(truncateAll);

const TODAY = "2026-03-15";
const base = { name: "Promo", kind: "percent", value: 1000, scope: "subscription" } as const;

async function invoice() {
  const plan = await makePlan();
  const sub = await makeSubscription(plan.id);
  return makeInvoice(sub.id, sub.customerId);
}

describe("discount service", () => {
  it("creates, updates and archives (admin) with activity", async () => {
    const admin = await makeUser("admin");
    const p1 = await makeProduct();
    const p2 = await makeProduct();
    const d = await createDiscount(testDb, { ...base, scope: "products", productIds: [p1.id] }, admin);
    expect((await getDiscount(testDb, d.id))?.productIds).toEqual([p1.id]);

    await updateDiscount(testDb, d.id, { ...base, name: "Renamed", scope: "products", productIds: [p2.id] }, admin);
    const got = await getDiscount(testDb, d.id);
    expect(got).toMatchObject({ name: "Renamed", productIds: [p2.id] });

    await archiveDiscount(testDb, d.id, admin);
    expect((await getDiscount(testDb, d.id))?.active).toBe(false);
    expect((await listActivity(testDb, "discount", d.id)).map((a) => a.action)).toEqual([
      "archived",
      "updated",
      "created",
    ]);
  });

  it("rejects non-admins and invalid input", async () => {
    const staff = await makeUser("staff");
    const admin = await makeUser("admin");
    await expect(createDiscount(testDb, base, staff)).rejects.toBeInstanceOf(DiscountError);
    await expect(createDiscount(testDb, { ...base, value: 20000 }, admin)).rejects.toThrow();
    await expect(updateDiscount(testDb, "00000000-0000-4000-8000-000000000000", base, admin)).rejects.toBeInstanceOf(
      DiscountError,
    );
  });
});

describe("listDiscounts status", () => {
  it("derives status in SQL", async () => {
    const admin = await makeUser("admin");
    const mk = (name: string, extra: object) => createDiscount(testDb, { ...base, name, ...extra }, admin);
    await mk("A active", {});
    await mk("B scheduled", { startsOn: "2026-04-01" });
    await mk("C expired", { endsOn: "2026-03-01" });
    const used = await mk("D used", { usageLimit: 1 });
    await testDb.update(discounts).set({ usedCount: 1 }).where(eq(discounts.id, used.id));
    await mk("E inactive", { active: false });

    const all = await listDiscounts(testDb, { today: TODAY });
    expect(Object.fromEntries(all.rows.map((r) => [r.name[0], r.status]))).toEqual({
      A: "active",
      B: "scheduled",
      C: "expired",
      D: "used_up",
      E: "inactive",
    });
    const only = await listDiscounts(testDb, { today: TODAY, status: "scheduled" });
    expect(only.rows.map((r) => r.name)).toEqual(["B scheduled"]);
    expect(only.total).toBe(1);
    expect((await listDiscounts(testDb, { today: TODAY, q: "inact" })).total).toBe(1);
  });
});

describe("listApplicableDiscounts", () => {
  it("filters by window, activity, usage and scope", async () => {
    const admin = await makeUser("admin");
    const p1 = await makeProduct();
    const p2 = await makeProduct();
    const mk = (name: string, extra: object) => createDiscount(testDb, { ...base, name, ...extra }, admin);
    await mk("sub", {});
    await mk("prod1", { scope: "products", productIds: [p1.id] });
    await mk("prod2", { scope: "products", productIds: [p2.id] });
    await mk("future", { startsOn: "2026-04-01" });
    await mk("past", { endsOn: "2026-03-14" });
    await mk("inactive", { active: false });
    const full = await mk("full", { usageLimit: 1 });
    await testDb.update(discounts).set({ usedCount: 1 }).where(eq(discounts.id, full.id));
    await mk("edge", { startsOn: TODAY, endsOn: TODAY });

    const rules = await listApplicableDiscounts(testDb, { productIds: [p1.id], on: TODAY });
    expect(rules.map((r) => r.name)).toEqual(["edge", "prod1", "sub"]);
    expect(rules.find((r) => r.name === "prod1")?.productIds).toEqual([p1.id]);
    const none = await listApplicableDiscounts(testDb, { productIds: [], on: TODAY });
    expect(none.map((r) => r.name)).toEqual(["edge", "sub"]);
  });
});

describe("redeemDiscounts", () => {
  it("records redemption and increments used_count; repeat is ignored", async () => {
    const admin = await makeUser("admin");
    const d = await createDiscount(testDb, base, admin);
    const inv = await invoice();
    expect(await redeemDiscounts(testDb, inv.id, [{ discountId: d.id, amount: 500 }])).toEqual([]);
    expect(await redeemDiscounts(testDb, inv.id, [{ discountId: d.id, amount: 500 }])).toEqual([]);
    expect((await getDiscount(testDb, d.id))?.usedCount).toBe(1);
    expect(await testDb.select().from(discountRedemptions)).toHaveLength(1);
  });

  it("returns ids over the usage limit and keeps no redemption for them", async () => {
    const admin = await makeUser("admin");
    const d = await createDiscount(testDb, { ...base, usageLimit: 1 }, admin);
    const a = await invoice();
    const b = await invoice();
    expect(await redeemDiscounts(testDb, a.id, [{ discountId: d.id, amount: 100 }])).toEqual([]);
    expect(await redeemDiscounts(testDb, b.id, [{ discountId: d.id, amount: 100 }])).toEqual([d.id]);
    expect((await getDiscount(testDb, d.id))?.usedCount).toBe(1);
    const reds = await testDb.select().from(discountRedemptions);
    expect(reds.map((r) => r.invoiceId)).toEqual([a.id]);
  });

  it("race: two concurrent redemptions at limit-1 let only one through", async () => {
    const admin = await makeUser("admin");
    const d = await createDiscount(testDb, { ...base, usageLimit: 2 }, admin);
    const first = await invoice();
    await redeemDiscounts(testDb, first.id, [{ discountId: d.id, amount: 1 }]);
    const [x, y] = [await invoice(), await invoice()];
    const results = await Promise.all([
      testDb.transaction((tx) => redeemDiscounts(tx, x.id, [{ discountId: d.id, amount: 1 }])),
      testDb.transaction((tx) => redeemDiscounts(tx, y.id, [{ discountId: d.id, amount: 1 }])),
    ]);
    expect(results.flat()).toEqual([d.id]);
    expect((await getDiscount(testDb, d.id))?.usedCount).toBe(2);
    expect(await testDb.select().from(discountRedemptions)).toHaveLength(2);
  });
});
