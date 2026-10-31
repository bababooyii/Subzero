import { beforeEach, describe, expect, it } from "vitest";
import { customers, invoices, plans, subscriptions } from "@/db/schema";
import { ServiceError } from "@/features/catalog/errors";
import type { Actor } from "@/lib/auth/session";
import { testDb as db, truncateAll } from "@/test/db";
import { getCustomer, listCustomers } from "./queries";
import { createCustomer, updateCustomer } from "./service";

const staff: Actor = { id: "s1", role: "staff" };
const customerActor: Actor = { id: "c1", role: "customer" };

beforeEach(truncateAll);

describe("createCustomer / updateCustomer", () => {
  it("creates a staff-made customer with null user_id", async () => {
    const { id } = await createCustomer(
      db,
      { name: "Asha", email: "Asha@Example.com", gstin: "22AAAAA0000A1Z5" },
      staff,
    );
    const c = await getCustomer(db, id);
    expect(c).toMatchObject({ email: "asha@example.com", userId: null, gstin: "22AAAAA0000A1Z5" });
  });

  it("rejects duplicate email with a field error, and customers as actors", async () => {
    await createCustomer(db, { name: "A", email: "a@example.com" }, staff);
    const err = await createCustomer(db, { name: "B", email: "A@example.com" }, staff).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.fieldErrors?.email).toBeDefined();
    await expect(
      createCustomer(db, { name: "C", email: "c@example.com" }, customerActor),
    ).rejects.toThrow("Forbidden");
  });

  it("updates, allowing the same email on the same record but not another's", async () => {
    const a = await createCustomer(db, { name: "A", email: "a@example.com" }, staff);
    const b = await createCustomer(db, { name: "B", email: "b@example.com" }, staff);
    await updateCustomer(db, a.id, { name: "A2", email: "a@example.com", phone: "123" }, staff);
    expect(await getCustomer(db, a.id)).toMatchObject({ name: "A2", phone: "123" });
    await expect(
      updateCustomer(db, b.id, { name: "B", email: "a@example.com" }, staff),
    ).rejects.toThrow(ServiceError);
    await expect(
      updateCustomer(db, "00000000-0000-4000-8000-000000000000", { name: "x", email: "x@example.com" }, staff),
    ).rejects.toThrow("not found");
  });
});

describe("listCustomers / getCustomer", () => {
  async function seed() {
    const [a, b, c] = await db
      .insert(customers)
      .values([
        { name: "Alpha", email: "alpha@example.com", company: "Acme" },
        { name: "Beta", email: "beta@example.com" },
        { name: "Gamma", email: "gamma@example.com" },
      ])
      .returning();
    const [plan] = await db.insert(plans).values({ name: "M" }).returning();
    const mkSub = async (n: string, customerId: string, status: "active" | "closed") =>
      (
        await db
          .insert(subscriptions)
          .values({ number: n, customerId, planId: plan.id, status, startDate: "2026-01-01" })
          .returning()
      )[0];
    const s1 = await mkSub("S1", a.id, "active");
    await mkSub("S2", a.id, "active");
    await mkSub("S3", a.id, "closed");
    const s4 = await mkSub("S4", b.id, "active");
    const inv = (
      number: string,
      sub: typeof s1,
      status: "draft" | "confirmed" | "paid",
      total: number,
      amountPaid: number,
      periodStart: string,
    ) => ({
      number,
      subscriptionId: sub.id,
      customerId: sub.customerId,
      customerSnapshot: {},
      periodStart,
      periodEnd: periodStart,
      status,
      issuedOn: periodStart,
      dueDate: periodStart,
      total,
      amountPaid,
    });
    await db.insert(invoices).values([
      inv("I1", s1, "confirmed", 10000, 2500, "2026-01-01"),
      inv("I2", s1, "confirmed", 5000, 0, "2026-02-01"),
      inv("I3", s1, "paid", 7000, 7000, "2026-03-01"),
      inv("I4", s1, "draft", 9999, 0, "2026-04-01"),
      inv("I5", s4, "confirmed", 3000, 1000, "2026-01-01"),
    ]);
    return { a, b, c };
  }

  it("computes active subscriptions and outstanding (confirmed only)", async () => {
    const { a, b, c } = await seed();
    const r = await listCustomers(db, {});
    const byId = Object.fromEntries(r.rows.map((x) => [x.id, x]));
    expect(byId[a.id]).toMatchObject({ activeSubscriptions: 2, outstanding: 12500 });
    expect(byId[b.id]).toMatchObject({ activeSubscriptions: 1, outstanding: 2000 });
    expect(byId[c.id]).toMatchObject({ activeSubscriptions: 0, outstanding: 0 });
    expect(r.total).toBe(3);

    expect(await getCustomer(db, a.id)).toMatchObject({
      subscriptionCount: 3,
      activeSubscriptions: 2,
      invoiceCount: 4,
      outstanding: 12500,
    });
  });

  it("sorts by outstanding, searches and paginates", async () => {
    await seed();
    const top = await listCustomers(db, { sort: "outstanding", dir: "desc", pageSize: 1 });
    expect(top.rows.map((x) => x.name)).toEqual(["Alpha"]);
    expect(top.total).toBe(3);
    expect((await listCustomers(db, { q: "acme" })).rows.map((x) => x.name)).toEqual(["Alpha"]);
    expect((await listCustomers(db, { page: 2, pageSize: 2 })).rows.map((x) => x.name)).toEqual([
      "Gamma",
    ]);
  });

  it("returns null for an unknown customer", async () => {
    expect(await getCustomer(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
