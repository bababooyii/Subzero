import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { invoices, quotationTemplates, subscriptions } from "@/db/schema";
import { addDays, todayIST } from "@/lib/dates";
import { listActivity } from "@/server/activity-log";
import { testDb, truncateAll } from "@/test/db";
import {
  makeCustomer,
  makeInvoice,
  makePlan,
  makeSubscription,
  makeUser,
} from "./fixtures";
import { InvalidTransitionError, transitionInvoice, transitionSubscription } from "./index";

beforeEach(truncateAll);

async function reload(id: string) {
  const [s] = await testDb.select().from(subscriptions).where(eq(subscriptions.id, id));
  return s;
}

describe("transitionSubscription", () => {
  it("updates the row and writes an activity entry", async () => {
    const actor = await makeUser("staff", "Sam Staff");
    const plan = await makePlan();
    const sub = await makeSubscription(plan.id);

    await transitionSubscription(testDb, { id: sub.id, to: "quotation", actor });

    expect((await reload(sub.id)).status).toBe("quotation");
    const log = await listActivity(testDb, "subscription", sub.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ fromStatus: "draft", toStatus: "quotation", actorName: "Sam Staff" });
  });

  it("throws InvalidTransitionError for a forbidden move and leaves the row untouched", async () => {
    const plan = await makePlan();
    const sub = await makeSubscription(plan.id);
    await expect(
      transitionSubscription(testDb, { id: sub.id, to: "active", actor: null }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect((await reload(sub.id)).status).toBe("draft");
    expect(await listActivity(testDb, "subscription", sub.id)).toHaveLength(0);
  });

  it("enforces plan guards, with system bypass for closing", async () => {
    const plan = await makePlan({ closable: false, pausable: false });
    const active = await makeSubscription(plan.id, { status: "active" });
    await expect(
      transitionSubscription(testDb, { id: active.id, to: "paused", actor: null }),
    ).rejects.toThrow(/pausing/);
    await expect(
      transitionSubscription(testDb, { id: active.id, to: "closed", actor: null }),
    ).rejects.toThrow(/closing/);
    await transitionSubscription(testDb, { id: active.id, to: "closed", actor: null, system: true });
    expect((await reload(active.id)).status).toBe("closed");
  });

  it("activate sets next_invoice_date to start_date when null, keeps an existing one", async () => {
    const plan = await makePlan();
    const a = await makeSubscription(plan.id, { status: "confirmed", startDate: "2026-03-05" });
    await transitionSubscription(testDb, { id: a.id, to: "active", actor: null });
    expect((await reload(a.id)).nextInvoiceDate).toBe("2026-03-05");

    const b = await makeSubscription(plan.id, {
      status: "confirmed",
      startDate: "2026-03-05",
      nextInvoiceDate: "2026-04-05",
    });
    await transitionSubscription(testDb, { id: b.id, to: "active", actor: null });
    expect((await reload(b.id)).nextInvoiceDate).toBe("2026-04-05");
  });

  it("close clears next_invoice_date", async () => {
    const plan = await makePlan();
    const sub = await makeSubscription(plan.id, { status: "active", nextInvoiceDate: "2026-02-01" });
    await transitionSubscription(testDb, { id: sub.id, to: "closed", actor: null });
    expect((await reload(sub.id)).nextInvoiceDate).toBeNull();
  });

  it("quotation sets validity: default +30 days, template days, and keeps an existing value", async () => {
    const plan = await makePlan();
    const dflt = await makeSubscription(plan.id);
    await transitionSubscription(testDb, { id: dflt.id, to: "quotation", actor: null });
    expect((await reload(dflt.id)).quotationValidUntil).toBe(addDays(todayIST(), 30));

    const [tpl] = await testDb.insert(quotationTemplates).values({ name: "T", validityDays: 10 }).returning();
    const withTpl = await makeSubscription(plan.id, { templateId: tpl.id });
    await transitionSubscription(testDb, { id: withTpl.id, to: "quotation", actor: null });
    expect((await reload(withTpl.id)).quotationValidUntil).toBe(addDays(todayIST(), 10));

    const preset = await makeSubscription(plan.id, { quotationValidUntil: "2030-01-01" });
    await transitionSubscription(testDb, { id: preset.id, to: "quotation", actor: null });
    expect((await reload(preset.id)).quotationValidUntil).toBe("2030-01-01");
  });

  it("serialises concurrent transitions (FOR UPDATE): only one wins", async () => {
    const plan = await makePlan();
    const sub = await makeSubscription(plan.id);
    const attempt = () =>
      testDb.transaction((tx) => transitionSubscription(tx, { id: sub.id, to: "quotation", actor: null }));
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(InvalidTransitionError);
    expect(await listActivity(testDb, "subscription", sub.id)).toHaveLength(1);
  });

  it("throws for an unknown id", async () => {
    await expect(
      transitionSubscription(testDb, { id: "00000000-0000-0000-0000-000000000000", to: "quotation", actor: null }),
    ).rejects.toThrow(/not found/);
  });
});

describe("transitionInvoice", () => {
  async function setup(overrides: Partial<typeof invoices.$inferInsert> = {}) {
    const plan = await makePlan();
    const customer = await makeCustomer();
    const sub = await makeSubscription(plan.id, { customerId: customer.id });
    return makeInvoice(sub.id, customer.id, overrides);
  }
  const reloadInv = async (id: string) =>
    (await testDb.select().from(invoices).where(eq(invoices.id, id)))[0];

  it("confirms a draft and logs activity", async () => {
    const actor = await makeUser("admin");
    const inv = await setup();
    await transitionInvoice(testDb, { id: inv.id, to: "confirmed", actor });
    expect((await reloadInv(inv.id)).status).toBe("confirmed");
    const log = await listActivity(testDb, "invoice", inv.id);
    expect(log[0]).toMatchObject({ fromStatus: "draft", toStatus: "confirmed" });
  });

  it("guards mark_paid on amount_paid and cancel on payments", async () => {
    const partial = await setup({ status: "confirmed", total: 10000, amountPaid: 4000 });
    await expect(
      transitionInvoice(testDb, { id: partial.id, to: "paid", actor: null }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    await expect(
      transitionInvoice(testDb, { id: partial.id, to: "cancelled", actor: null }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);

    const full = await setup({ status: "confirmed", total: 10000, amountPaid: 10000 });
    await transitionInvoice(testDb, { id: full.id, to: "paid", actor: null });
    expect((await reloadInv(full.id)).status).toBe("paid");

    const unpaid = await setup({ status: "confirmed" });
    await transitionInvoice(testDb, { id: unpaid.id, to: "cancelled", actor: null });
    expect((await reloadInv(unpaid.id)).status).toBe("cancelled");
  });

  it("rejects moves out of terminal states", async () => {
    const inv = await setup({ status: "cancelled" });
    await expect(
      transitionInvoice(testDb, { id: inv.id, to: "confirmed", actor: null }),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
  });
});
