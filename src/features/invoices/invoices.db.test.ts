import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tx } from "@/db/client";
import {
  activityLog,
  customers,
  invoiceLines,
  invoices,
  payments,
  plans,
  subscriptions,
  user,
} from "@/db/schema";
import { ServiceError } from "@/features/catalog/errors";
import type { Actor } from "@/lib/auth/session";
import { testDb as db, truncateAll } from "@/test/db";
import { getInvoice, listInvoices } from "./queries";
import {
  availableActions,
  bulkConfirm,
  bulkSend,
  cancelInvoice,
  confirmInvoice,
  sendInvoice,
  type InvoiceDeps,
} from "./service";

const sendMail = vi.hoisted(() => vi.fn(async () => ({})));
vi.mock("@/server/mail", () => ({ sendMail }));

const staff: Actor = { id: "s1", role: "staff" };
const customerActor: Actor = { id: "c1", role: "customer" };
const TODAY = "2026-03-15";

/** Fake state machine: enforces the same simple rules and writes the status. */
const transitions: { id: string; to: string }[] = [];
const deps: InvoiceDeps = {
  async transitionInvoice(tx, { id, to }) {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id));
    const ok =
      (inv.status === "draft" && (to === "confirmed" || to === "cancelled")) ||
      (inv.status === "confirmed" &&
        to === "cancelled" &&
        inv.amountPaid === 0);
    if (!ok)
      throw new ServiceError(`Cannot move invoice from ${inv.status} to ${to}`);
    transitions.push({ id, to });
    await tx
      .update(invoices)
      .set({ status: to as "confirmed" })
      .where(eq(invoices.id, id));
    return {};
  },
  async listActivity(d, type, id) {
    return d
      .select()
      .from(activityLog)
      .where(eq(activityLog.entityId, id))
      .then((r) => r.filter((x) => x.entityType === type));
  },
};

beforeEach(async () => {
  await truncateAll();
  transitions.length = 0;
  sendMail.mockClear();
  await db
    .insert(user)
    .values({
      id: staff.id,
      name: "Staff",
      email: "staff@example.com",
      role: "staff",
    });
});

async function seed() {
  const [cust] = await db
    .insert(customers)
    .values({ name: "Asha Rao", email: "asha@example.com" })
    .returning();
  const [plan] = await db.insert(plans).values({ name: "Monthly" }).returning();
  const [sub] = await db
    .insert(subscriptions)
    .values({
      number: "SUB-1",
      customerId: cust.id,
      planId: plan.id,
      startDate: "2026-01-01",
    })
    .returning();
  let n = 0;
  const mk = async (
    status: "draft" | "confirmed" | "paid" | "cancelled",
    total: number,
    amountPaid: number,
    dueDate: string,
  ) => {
    n += 1;
    const periodStart = `2026-0${n}-01`;
    const [inv] = await db
      .insert(invoices)
      .values({
        number: `INV-000${n}`,
        subscriptionId: sub.id,
        customerId: cust.id,
        customerSnapshot: { name: cust.name },
        periodStart,
        periodEnd: periodStart,
        status,
        issuedOn: periodStart,
        dueDate,
        subtotal: total,
        total,
        amountPaid,
      })
      .returning();
    return inv;
  };
  return { cust, sub, mk };
}

describe("availableActions", () => {
  it("follows the state-machine rules", () => {
    expect(
      availableActions({ status: "draft", total: 100, amountPaid: 0 }),
    ).toEqual(["confirm", "cancel"]);
    expect(
      availableActions({ status: "confirmed", total: 100, amountPaid: 0 }),
    ).toEqual(["cancel"]);
    expect(
      availableActions({ status: "confirmed", total: 100, amountPaid: 10 }),
    ).toEqual([]);
    expect(
      availableActions({ status: "paid", total: 100, amountPaid: 100 }),
    ).toEqual([]);
    expect(
      availableActions({ status: "cancelled", total: 100, amountPaid: 0 }),
    ).toEqual([]);
  });
});

describe("listInvoices", () => {
  it("filters by view and derives displayStatus", async () => {
    const { mk } = await seed();
    const draft = await mk("draft", 1000, 0, "2026-04-01");
    const open = await mk("confirmed", 1000, 0, "2026-04-01");
    const overdue = await mk("confirmed", 1000, 0, "2026-03-01");
    const partial = await mk("confirmed", 1000, 400, "2026-04-01");
    const paid = await mk("paid", 1000, 1000, "2026-02-01");

    const ids = async (view: "all" | "draft" | "unpaid" | "overdue" | "paid") =>
      (
        await listInvoices(db, {
          view,
          today: TODAY,
          sort: "number",
          dir: "asc",
        })
      ).rows.map((r) => r.id);

    expect(await ids("all")).toEqual([
      draft.id,
      open.id,
      overdue.id,
      partial.id,
      paid.id,
    ]);
    expect(await ids("draft")).toEqual([draft.id]);
    expect(await ids("unpaid")).toEqual([open.id, overdue.id, partial.id]);
    expect(await ids("overdue")).toEqual([overdue.id]);
    expect(await ids("paid")).toEqual([paid.id]);

    const all = await listInvoices(db, {
      today: TODAY,
      sort: "number",
      dir: "asc",
    });
    expect(all.rows.map((r) => r.displayStatus)).toEqual([
      "draft",
      "confirmed",
      "overdue",
      "partially_paid",
      "paid",
    ]);
    expect(all.rows[3]).toMatchObject({
      balance: 600,
      customerName: "Asha Rao",
      subscriptionNumber: "SUB-1",
    });
    expect(all.total).toBe(5);
  });

  it("filters by customer, subscription, search and pages in SQL", async () => {
    const { cust, sub, mk } = await seed();
    await mk("draft", 100, 0, "2026-04-01");
    await mk("draft", 100, 0, "2026-04-01");
    await mk("draft", 100, 0, "2026-04-01");
    const page = await listInvoices(db, {
      today: TODAY,
      pageSize: 2,
      page: 2,
      sort: "number",
      dir: "asc",
    });
    expect(page.rows.map((r) => r.number)).toEqual(["INV-0003"]);
    expect(page.total).toBe(3);
    expect(
      (await listInvoices(db, { today: TODAY, q: "0002" })).rows,
    ).toHaveLength(1);
    expect((await listInvoices(db, { today: TODAY, q: "asha" })).total).toBe(3);
    expect(
      (await listInvoices(db, { today: TODAY, customerId: cust.id })).total,
    ).toBe(3);
    expect(
      (
        await listInvoices(db, {
          today: TODAY,
          subscriptionId: "00000000-0000-4000-8000-000000000000",
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await listInvoices(db, {
          today: TODAY,
          subscriptionId: sub.id,
          status: "paid",
        })
      ).total,
    ).toBe(0);
  });
});

describe("getInvoice", () => {
  it("returns header, snapshot, lines, payments, activity and actions; null when missing", async () => {
    const { mk } = await seed();
    const inv = await mk("confirmed", 1000, 0, "2026-03-01");
    await db.insert(invoiceLines).values({
      invoiceId: inv.id,
      description: "Pro plan",
      quantity: 2,
      unitPrice: 500,
      lineTotal: 1000,
    });
    await db
      .insert(payments)
      .values({
        invoiceId: inv.id,
        method: "upi",
        amount: 0,
        paidOn: "2026-03-02",
      });
    await db
      .insert(activityLog)
      .values({ entityType: "invoice", entityId: inv.id, action: "created" });

    const got = await getInvoice(db, inv.id, { today: TODAY, deps });
    expect(got).toMatchObject({
      number: inv.number,
      snapshot: { name: "Asha Rao" },
      displayStatus: "overdue",
      balance: 1000,
      availableActions: ["cancel"],
    });
    expect(got?.lines).toHaveLength(1);
    expect(got?.payments).toHaveLength(1);
    expect(got?.activity).toHaveLength(1);
    expect(
      await getInvoice(db, "00000000-0000-4000-8000-000000000000", {
        today: TODAY,
        deps,
      }),
    ).toBeNull();
  });
});

describe("confirm / cancel", () => {
  it("confirms a draft through the injected transition", async () => {
    const { mk } = await seed();
    const inv = await mk("draft", 1000, 0, "2026-04-01");
    await db.transaction((tx) => confirmInvoice(tx, inv.id, staff, deps));
    expect(transitions).toEqual([{ id: inv.id, to: "confirmed" }]);
  });

  it("guards: role, missing invoice, bad id, cancel when payments exist", async () => {
    const { mk } = await seed();
    const draft = await mk("draft", 1000, 0, "2026-04-01");
    const part = await mk("confirmed", 1000, 100, "2026-04-01");
    await expect(
      db.transaction((tx) => confirmInvoice(tx, draft.id, customerActor, deps)),
    ).rejects.toThrow("Forbidden");
    await expect(
      db.transaction((tx) =>
        confirmInvoice(tx, "00000000-0000-4000-8000-000000000000", staff, deps),
      ),
    ).rejects.toThrow("not found");
    await expect(
      db.transaction((tx) => confirmInvoice(tx, "nope", staff, deps)),
    ).rejects.toThrow();
    await expect(
      db.transaction((tx) => cancelInvoice(tx, part.id, staff, deps)),
    ).rejects.toThrow("cannot be cancelled");
    expect(transitions).toEqual([]);
    await db.transaction((tx) => cancelInvoice(tx, draft.id, staff, deps));
    expect(transitions).toEqual([{ id: draft.id, to: "cancelled" }]);
  });
});

describe("sendInvoice", () => {
  it("confirms a draft, emails the customer, sets sent_at and logs activity", async () => {
    const { mk } = await seed();
    const inv = await mk("draft", 1000, 0, "2026-04-01");
    await db.transaction((tx) => sendInvoice(tx, inv.id, staff, deps));
    expect(transitions).toEqual([{ id: inv.id, to: "confirmed" }]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0] as unknown as [
      { to: string; text: string },
    ];
    expect(mail[0].to).toBe("asha@example.com");
    expect(mail[0].text).toContain(`/invoices/${inv.id}`);
    const [row] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, inv.id));
    expect(row.sentAt).not.toBeNull();
    const log = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.entityId, inv.id));
    expect(log.map((l) => l.action)).toEqual(["sent"]);
  });

  it("does not re-confirm a confirmed invoice, and rejects cancelled ones", async () => {
    const { mk } = await seed();
    const open = await mk("confirmed", 1000, 0, "2026-04-01");
    const dead = await mk("cancelled", 1000, 0, "2026-04-01");
    await db.transaction((tx) => sendInvoice(tx, open.id, staff, deps));
    expect(transitions).toEqual([]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    await expect(
      db.transaction((tx) => sendInvoice(tx, dead.id, staff, deps)),
    ).rejects.toThrow("cancelled invoice cannot be sent");
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});

describe("bulk actions", () => {
  it("collects per-invoice failures without aborting the batch", async () => {
    const { mk } = await seed();
    const a = await mk("draft", 1000, 0, "2026-04-01");
    const b = await mk("paid", 1000, 1000, "2026-04-01");
    const c = await mk("draft", 1000, 0, "2026-04-01");
    const res = await db.transaction((tx: Tx) =>
      bulkConfirm(tx, [a.id, b.id, c.id], staff, deps),
    );
    expect(res.done).toEqual([a.id, c.id]);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].id).toBe(b.id);
    const rows = await db.select().from(invoices);
    expect(rows.filter((r) => r.status === "confirmed")).toHaveLength(2);
  });

  it("bulkSend sends each and validates input", async () => {
    const { mk } = await seed();
    const a = await mk("draft", 1000, 0, "2026-04-01");
    const b = await mk("draft", 1000, 0, "2026-04-01");
    const res = await db.transaction((tx) =>
      bulkSend(tx, [a.id, b.id], staff, deps),
    );
    expect(res.done).toHaveLength(2);
    expect(sendMail).toHaveBeenCalledTimes(2);
    await expect(
      db.transaction((tx) => bulkSend(tx, [], staff, deps)),
    ).rejects.toThrow();
    await expect(
      db.transaction((tx) => bulkSend(tx, [a.id], customerActor, deps)),
    ).rejects.toThrow("Forbidden");
  });
});
