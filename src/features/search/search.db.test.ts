import { beforeEach, describe, expect, it } from "vitest";
import { customers, invoices, plans, products, subscriptions } from "@/db/schema";
import { testDb, truncateAll } from "@/test/db";
import { globalSearch } from "./queries";

beforeEach(truncateAll);

async function seed() {
  const [acme] = await testDb.insert(customers).values({ name: "Acme Corp", email: "ops@acme.test" }).returning();
  const [zed] = await testDb.insert(customers).values({ name: "Zed", email: "zed@z.test" }).returning();
  const [plan] = await testDb.insert(plans).values({ name: "Monthly", interval: "monthly" }).returning();
  const [sub] = await testDb
    .insert(subscriptions)
    .values({ number: "SUB-0001", customerId: acme!.id, planId: plan!.id, status: "active", startDate: "2026-01-01" })
    .returning();
  await testDb.insert(invoices).values({
    number: "INV-0001",
    subscriptionId: sub!.id,
    customerId: acme!.id,
    customerSnapshot: { name: "Acme Corp" },
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    status: "confirmed",
    issuedOn: "2026-01-01",
    dueDate: "2026-01-15",
    total: 1000,
  });
  await testDb.insert(products).values({ name: "Acme Widget" });
  return { acme: acme!, zed: zed! };
}

describe("globalSearch", () => {
  it("finds across sections by name, number and customer", async () => {
    await seed();
    const r = await globalSearch(testDb, "acme", { today: "2026-10-31" });
    expect(r.customers.map((c) => c.name)).toEqual(["Acme Corp"]);
    expect(r.subscriptions).toMatchObject([{ number: "SUB-0001", customerName: "Acme Corp", status: "active" }]);
    expect(r.invoices).toMatchObject([{ number: "INV-0001", customerName: "Acme Corp", displayStatus: "overdue" }]);
    expect(r.products.map((p) => p.name)).toEqual(["Acme Widget"]);

    const byNumber = await globalSearch(testDb, "inv-0001");
    expect(byNumber.invoices).toHaveLength(1);
    expect(byNumber.customers).toHaveLength(0);
  });

  it("limits each section, escapes wildcards and ignores blank queries", async () => {
    await seed();
    for (let i = 0; i < 4; i++) await testDb.insert(products).values({ name: `Gadget ${i}` });
    expect((await globalSearch(testDb, "gadget", { limit: 3 })).products).toHaveLength(3);
    expect((await globalSearch(testDb, "%")).customers).toHaveLength(0);
    expect(await globalSearch(testDb, "   ")).toEqual({ customers: [], subscriptions: [], invoices: [], products: [] });
  });
});
