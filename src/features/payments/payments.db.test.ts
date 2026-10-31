import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { invoices } from "@/db/schema";
import { listActivity } from "@/server/activity-log";
import { makeInvoice, makePlan, makeSubscription, makeUser } from "@/server/state-machine/fixtures";
import { testDb, truncateAll } from "@/test/db";
import { invoiceBalance, listOutstanding, listPayments } from "./queries";
import { deletePayment, PaymentError, recordPayment } from "./service";

beforeEach(truncateAll);

async function setup(overrides: Partial<typeof invoices.$inferInsert> = {}) {
  const plan = await makePlan();
  const sub = await makeSubscription(plan.id);
  const inv = await makeInvoice(sub.id, sub.customerId, { status: "confirmed", total: 10000, ...overrides });
  return { inv, sub };
}
const pay = (invoiceId: string, amount: number, extra: object = {}) => ({
  invoiceId,
  method: "upi" as const,
  amount,
  paidOn: "2026-01-02",
  ...extra,
});
const status = async (id: string) => (await testDb.select().from(invoices).where(eq(invoices.id, id)))[0];

describe("recordPayment", () => {
  it("partial then full payment marks the invoice paid", async () => {
    const actor = await makeUser("staff");
    const { inv } = await setup();
    await recordPayment(testDb, pay(inv.id, 4000), actor);
    let row = await status(inv.id);
    expect(row).toMatchObject({ status: "confirmed", amountPaid: 4000 });
    expect(await invoiceBalance(testDb, inv.id)).toEqual({ total: 10000, amountPaid: 4000, balance: 6000 });

    await recordPayment(testDb, pay(inv.id, 6000), actor);
    row = await status(inv.id);
    expect(row).toMatchObject({ status: "paid", amountPaid: 10000 });
    const log = await listActivity(testDb, "invoice", inv.id);
    expect(log.some((a) => a.toStatus === "paid")).toBe(true);
  });

  it("rejects overpayment", async () => {
    const actor = await makeUser("staff");
    const { inv } = await setup();
    await expect(recordPayment(testDb, pay(inv.id, 10001), actor)).rejects.toBeInstanceOf(PaymentError);
    expect((await status(inv.id)).amountPaid).toBe(0);
  });

  it("rejects payment on a draft invoice", async () => {
    const actor = await makeUser("staff");
    const { inv } = await setup({ status: "draft" });
    await expect(recordPayment(testDb, pay(inv.id, 100), actor)).rejects.toBeInstanceOf(PaymentError);
  });

  it("validates amount and future date", async () => {
    const actor = await makeUser("staff");
    const { inv } = await setup();
    await expect(recordPayment(testDb, pay(inv.id, 0), actor)).rejects.toThrow();
    await expect(recordPayment(testDb, pay(inv.id, 100, { paidOn: "2999-01-01" }), actor)).rejects.toThrow();
    await expect(recordPayment(testDb, pay(inv.id, 100, { note: "x".repeat(501) }), actor)).rejects.toThrow();
  });

  it("concurrent payments cannot overpay", async () => {
    const actor = await makeUser("staff");
    const { inv } = await setup();
    const results = await Promise.allSettled([
      testDb.transaction((tx) => recordPayment(tx, pay(inv.id, 6000), actor)),
      testDb.transaction((tx) => recordPayment(tx, pay(inv.id, 6000), actor)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await status(inv.id)).amountPaid).toBe(6000);
  });
});

describe("deletePayment", () => {
  it("removes the payment and restores the balance (admin)", async () => {
    const admin = await makeUser("admin");
    const { inv } = await setup();
    const p = await recordPayment(testDb, pay(inv.id, 3000), admin);
    await deletePayment(testDb, p.id, admin);
    expect((await status(inv.id)).amountPaid).toBe(0);
    expect((await listPayments(testDb, {})).total).toBe(0);
    expect((await listActivity(testDb, "payment", p.id)).map((a) => a.action)).toEqual(["deleted", "recorded"]);
  });

  it("refuses non-admins and paid invoices", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const { inv } = await setup();
    const part = await recordPayment(testDb, pay(inv.id, 3000), admin);
    await expect(deletePayment(testDb, part.id, staff)).rejects.toBeInstanceOf(PaymentError);
    const rest = await recordPayment(testDb, pay(inv.id, 7000), admin);
    await expect(deletePayment(testDb, rest.id, admin)).rejects.toBeInstanceOf(PaymentError);
    expect((await status(inv.id)).status).toBe("paid");
  });
});

describe("payment queries", () => {
  it("lists payments with filters", async () => {
    const actor = await makeUser("staff");
    const a = await setup();
    const b = await setup();
    await recordPayment(testDb, pay(a.inv.id, 1000, { method: "cash", paidOn: "2026-01-05" }), actor);
    await recordPayment(testDb, pay(b.inv.id, 2000, { paidOn: "2026-01-10" }), actor);

    const all = await listPayments(testDb, {});
    expect(all.total).toBe(2);
    expect(all.rows[0]).toMatchObject({ invoiceNumber: b.inv.number, amount: 2000 });
    expect((await listPayments(testDb, { method: "cash" })).rows).toHaveLength(1);
    expect((await listPayments(testDb, { from: "2026-01-08" })).rows).toHaveLength(1);
    expect((await listPayments(testDb, { to: "2026-01-06" })).rows).toHaveLength(1);
    expect((await listPayments(testDb, { customerId: a.sub.customerId })).rows[0].amount).toBe(1000);
    expect((await listPayments(testDb, { q: b.inv.number })).rows).toHaveLength(1);
  });

  it("lists outstanding invoices with days overdue", async () => {
    const actor = await makeUser("staff");
    const overdue = await setup({ dueDate: "2026-03-05" });
    const notDue = await setup({ dueDate: "2026-03-20" });
    await setup({ status: "draft" });
    const paid = await setup({ status: "paid", amountPaid: 10000 });
    await recordPayment(testDb, pay(overdue.inv.id, 2500), actor);

    const out = await listOutstanding(testDb, { today: "2026-03-15" });
    expect(out.total).toBe(2);
    const byId = Object.fromEntries(out.rows.map((r) => [r.invoiceId, r]));
    expect(byId[overdue.inv.id]).toMatchObject({ daysOverdue: 10, balance: 7500 });
    expect(byId[notDue.inv.id]).toMatchObject({ daysOverdue: 0, balance: 10000 });
    expect(byId[paid.inv.id]).toBeUndefined();

    const only = await listOutstanding(testDb, { today: "2026-03-15", overdueOnly: true });
    expect(only.rows.map((r) => r.invoiceId)).toEqual([overdue.inv.id]);
  });
});
