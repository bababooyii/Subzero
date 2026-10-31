import { beforeEach, describe, expect, it } from "vitest";
import { discounts, subscriptionLines } from "@/db/schema";
import { makeCustomer, makePlan, makeProduct, makeSubscription, makeUser, makeVariant } from "@/server/state-machine/fixtures";
import { testDb, truncateAll } from "@/test/db";
import { getSubscription, listSubscriptions, quoteSubscription, subscriptionCounts } from "./queries";

beforeEach(truncateAll);

const TODAY = "2026-03-15";

async function seed() {
  const plan = await makePlan({ name: "Gold" });
  const alice = await makeCustomer({ name: "Alice Ltd" });
  const bob = await makeCustomer({ name: "Bob Co" });
  const product = await makeProduct({ salesPrice: 10000, taxRatesBps: [1800] });
  const mk = (o: Parameters<typeof makeSubscription>[1]) => makeSubscription(plan.id, o);
  const active = await mk({ number: "SUB-0001", customerId: alice.id, status: "active", nextInvoiceDate: TODAY, expiryDate: "2026-03-31" });
  const dueLater = await mk({ number: "SUB-0002", customerId: bob.id, status: "active", nextInvoiceDate: "2026-04-01", expiryDate: "2027-01-01" });
  const paused = await mk({ number: "SUB-0003", customerId: alice.id, status: "paused", expiryDate: "2026-04-10" });
  const quotation = await mk({ number: "SUB-0004", customerId: bob.id, status: "quotation" });
  await mk({ number: "SUB-0005", customerId: bob.id, status: "closed" });
  await testDb.insert(subscriptionLines).values([
    { subscriptionId: active.id, productId: product.id, quantity: 2, unitPrice: 10000 },
    { subscriptionId: active.id, productId: product.id, quantity: 1, unitPrice: 5000 },
  ]);
  return { plan, alice, bob, product, active, dueLater, paused, quotation };
}

describe("listSubscriptions", () => {
  it("returns recurring totals computed in SQL and paging info", async () => {
    const { active } = await seed();
    const page = await listSubscriptions(testDb, { today: TODAY });
    expect(page.total).toBe(5);
    expect(page.rows.find((r) => r.id === active.id)).toMatchObject({
      customerName: "Alice Ltd",
      planName: "Gold",
      recurringTotal: 25000,
    });
    expect(page.rows[0].number).toBe("SUB-0005"); // default: newest number first
  });

  it("filters by views", async () => {
    await seed();
    const nums = async (view: Parameters<typeof listSubscriptions>[1]["view"]) =>
      (await listSubscriptions(testDb, { today: TODAY, view, sort: "number", dir: "asc" })).rows.map((r) => r.number);
    expect(await nums("active")).toEqual(["SUB-0001", "SUB-0002"]);
    expect(await nums("paused")).toEqual(["SUB-0003"]);
    expect(await nums("due_today")).toEqual(["SUB-0001"]);
    expect(await nums("closing_this_month")).toEqual(["SUB-0001"]);
    expect(await nums("quotations")).toEqual(["SUB-0004"]);
    expect(await nums("all")).toHaveLength(5);
  });

  it("filters by status, customer, plan, search and paginates", async () => {
    const { bob, plan } = await seed();
    expect((await listSubscriptions(testDb, { today: TODAY, status: "paused" })).total).toBe(1);
    expect((await listSubscriptions(testDb, { today: TODAY, customerId: bob.id })).total).toBe(3);
    expect((await listSubscriptions(testDb, { today: TODAY, planId: plan.id })).total).toBe(5);
    expect((await listSubscriptions(testDb, { today: TODAY, q: "alice" })).total).toBe(2);
    expect((await listSubscriptions(testDb, { today: TODAY, q: "SUB-0004" })).total).toBe(1);
    const p2 = await listSubscriptions(testDb, { today: TODAY, pageSize: 2, page: 3 });
    expect(p2.rows).toHaveLength(1);
    expect(p2.total).toBe(5);
  });

  it("sorts by recurringTotal", async () => {
    const { active } = await seed();
    const r = await listSubscriptions(testDb, { today: TODAY, sort: "recurringTotal", dir: "desc" });
    expect(r.rows[0].id).toBe(active.id);
  });
});

describe("getSubscription", () => {
  it("returns header, customer, plan, lines with variant label, actions and activity", async () => {
    const { active, product } = await seed();
    const variant = await makeVariant(product.id, 0);
    await testDb.insert(subscriptionLines).values({ subscriptionId: active.id, productId: product.id, variantId: variant.id, quantity: 1, unitPrice: 1 });
    const s = await getSubscription(testDb, active.id);
    expect(s?.customer.name).toBe("Alice Ltd");
    expect(s?.plan.name).toBe("Gold");
    expect(s?.lines).toHaveLength(3);
    expect(s?.lines.find((l) => l.variantId)?.variantLabel).toMatch(/^Tier: V/);
    expect(s?.availableActions.map((a) => a.action).sort()).toEqual(["close", "pause"]);
    expect(Array.isArray(s?.activity)).toBe(true);
  });

  it("returns null when missing", async () => {
    expect(await getSubscription(testDb, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("quoteSubscription", () => {
  it("prices lines with product taxes and given discounts", async () => {
    const { active } = await seed();
    const q = await quoteSubscription(testDb, active.id, TODAY);
    expect(q.subtotal).toBe(25000);
    expect(q.taxTotal).toBe(4500);
    expect(q.total).toBe(29500);

    const withDiscount = await quoteSubscription(testDb, active.id, TODAY, [
      {
        id: "d1", name: "10%", kind: "percent", value: 1000, scope: "subscription", productIds: [],
        minAmount: null, minQty: null, startsOn: null, endsOn: null, usageLimit: null, usedCount: 0, active: true,
      },
    ]);
    expect(withDiscount.discountTotal).toBe(2500);
    expect(withDiscount.total).toBe(26550);
  });

  it("defaults to the applicable discounts from the database", async () => {
    const { active } = await seed();
    await testDb.insert(discounts).values({ name: "10%", kind: "percent", value: 1000, scope: "subscription" });
    const q = await quoteSubscription(testDb, active.id, TODAY);
    expect(q.discountTotal).toBe(2500);
  });
});

describe("subscriptionCounts", () => {
  it("counts chips", async () => {
    await seed();
    await makeUser();
    expect(await subscriptionCounts(testDb, TODAY)).toEqual({ dueToday: 1, active: 2, paused: 1, quotations: 1 });
  });
});
