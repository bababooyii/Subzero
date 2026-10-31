import { beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, truncateAll } from "@/test/db";
import {
  customers,
  invoiceLines,
  invoices,
  payments,
  plans,
  products,
  subscriptionLines,
  subscriptions,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { getInvoiceForPrint, getMyInvoice, myInvoices, mySubscriptions } from "./queries";
import { cancelMySubscription, pauseMySubscription, resumeMySubscription, type PortalDeps } from "./service";

let n = 0;
const A: Actor = { id: "user-a", role: "customer" };
const B: Actor = { id: "user-b", role: "customer" };
const STAFF: Actor = { id: "user-staff", role: "staff" };

let custA: string;
let custB: string;
let planId: string;
let noPausePlanId: string;
let noClosePlanId: string;

async function mkCustomer(userId: string, name: string) {
  await testDb.insert(user).values({ id: userId, name, email: `${userId}@x.test`, role: userId === "user-staff" ? "staff" : "customer" });
  if (userId === "user-staff") return "";
  const [c] = await testDb.insert(customers).values({ userId, name, email: `${userId}@x.test`, gstin: "GST-LIVE" }).returning();
  return c!.id;
}

async function mkSub(customerId: string, plan: string, st: "active" | "paused" | "draft" | "closed" = "active") {
  const [s] = await testDb
    .insert(subscriptions)
    .values({ number: `SUB-${++n}`, customerId, planId: plan, status: st, startDate: "2026-01-01", nextInvoiceDate: "2026-11-01" })
    .returning();
  const [p] = await testDb.insert(products).values({ name: `P${n}` }).returning();
  await testDb.insert(subscriptionLines).values([
    { subscriptionId: s!.id, productId: p!.id, quantity: 2, unitPrice: 5000 },
    { subscriptionId: s!.id, productId: p!.id, quantity: 1, unitPrice: 2500 },
  ]);
  return s!.id;
}

async function mkInvoice(customerId: string, subId: string, st: "draft" | "confirmed" | "paid" = "confirmed", number?: string) {
  n++;
  const [i] = await testDb
    .insert(invoices)
    .values({
      number: number ?? `INV-${n}`,
      subscriptionId: subId,
      customerId,
      customerSnapshot: { name: "Snapshot Name", email: "snap@x.test", gstin: "GST-SNAP" },
      periodStart: `2025-01-${String(n).padStart(2, "0")}`,
      periodEnd: `2025-02-${String(n).padStart(2, "0")}`,
      status: st,
      issuedOn: "2026-10-01",
      dueDate: "2026-10-15",
      subtotal: 10000,
      taxTotal: 1800,
      total: 11800,
      amountPaid: 3000,
    })
    .returning();
  await testDb.insert(invoiceLines).values({ invoiceId: i!.id, description: "Plan", quantity: 1, unitPrice: 10000, taxRateBps: 1800, taxAmount: 1800, lineTotal: 11800 });
  await testDb.insert(payments).values({ invoiceId: i!.id, method: "upi", amount: 3000, paidOn: "2026-10-05" });
  return i!.id;
}

const deps = (): PortalDeps & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return {
    calls,
    transitionSubscription: vi.fn(async (_db, input) => {
      calls.push(input);
    }),
  };
};

beforeEach(async () => {
  await truncateAll();
  n = 0;
  custA = await mkCustomer("user-a", "Alice");
  custB = await mkCustomer("user-b", "Bob");
  await mkCustomer("user-staff", "Staff");
  const [p] = await testDb.insert(plans).values({ name: "Monthly", interval: "monthly" }).returning();
  const [np] = await testDb.insert(plans).values({ name: "NoPause", pausable: false }).returning();
  const [nc] = await testDb.insert(plans).values({ name: "NoClose", closable: false }).returning();
  planId = p!.id;
  noPausePlanId = np!.id;
  noClosePlanId = nc!.id;
});

describe("mySubscriptions", () => {
  it("returns only own, non-draft subscriptions with recurring amount and action flags", async () => {
    const mine = await mkSub(custA, planId);
    await mkSub(custA, planId, "draft");
    await mkSub(custB, planId);
    const rows = await mySubscriptions(testDb, A);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: mine,
      recurringAmount: 12500,
      nextInvoiceDate: "2026-11-01",
      canPause: true,
      canResume: false,
      canCancel: true,
      plan: { name: "Monthly" },
    });
  });

  it("derives flags from plan and status", async () => {
    await mkSub(custA, noPausePlanId);
    await mkSub(custA, noClosePlanId, "paused");
    const rows = await mySubscriptions(testDb, A);
    const np = rows.find((r) => r.plan.name === "NoPause")!;
    const nc = rows.find((r) => r.plan.name === "NoClose")!;
    expect(np).toMatchObject({ canPause: false, canCancel: true });
    expect(nc).toMatchObject({ canPause: false, canResume: true, canCancel: false });
  });

  it("is empty for staff and for a customer user without a customers row", async () => {
    await mkSub(custA, planId);
    expect(await mySubscriptions(testDb, STAFF)).toEqual([]);
    expect(await mySubscriptions(testDb, { id: "ghost", role: "customer" })).toEqual([]);
  });
});

describe("myInvoices / getMyInvoice", () => {
  it("lists only own non-draft invoices, with paging and search", async () => {
    const subA = await mkSub(custA, planId);
    const subB = await mkSub(custB, planId);
    await mkInvoice(custA, subA, "confirmed", "INV-A-1");
    await mkInvoice(custA, subA, "paid", "INV-A-2");
    await mkInvoice(custA, subA, "draft", "INV-A-3");
    await mkInvoice(custB, subB, "confirmed", "INV-B-1");

    const all = await myInvoices(testDb, A);
    expect(all.total).toBe(2);
    expect(all.rows.map((r) => r.number).sort()).toEqual(["INV-A-1", "INV-A-2"]);
    expect(all.rows[0]!.balance).toBe(8800);

    const found = await myInvoices(testDb, A, { q: "A-2" });
    expect(found.rows.map((r) => r.number)).toEqual(["INV-A-2"]);
    const paged = await myInvoices(testDb, A, { pageSize: 1, page: 2 });
    expect(paged.rows).toHaveLength(1);
    expect(paged.total).toBe(2);
  });

  it("returns null for another customer's invoice, a draft, or a bad id", async () => {
    const subA = await mkSub(custA, planId);
    const subB = await mkSub(custB, planId);
    const mine = await mkInvoice(custA, subA);
    const draft = await mkInvoice(custA, subA, "draft");
    const theirs = await mkInvoice(custB, subB);

    const got = await getMyInvoice(testDb, A, mine);
    expect(got?.lines).toHaveLength(1);
    expect(got?.payments).toHaveLength(1);
    expect(await getMyInvoice(testDb, A, theirs)).toBeNull();
    expect(await getMyInvoice(testDb, B, mine)).toBeNull();
    expect(await getMyInvoice(testDb, A, draft)).toBeNull();
    expect(await getMyInvoice(testDb, A, "not-a-uuid")).toBeNull();
  });
});

describe("getInvoiceForPrint", () => {
  it("gives staff any invoice and a customer only their own", async () => {
    const subA = await mkSub(custA, planId);
    const subB = await mkSub(custB, planId);
    const mine = await mkInvoice(custA, subA);
    const theirs = await mkInvoice(custB, subB);

    const asStaff = await getInvoiceForPrint(testDb, STAFF, theirs);
    expect(asStaff?.company.name).toBeTruthy();
    expect(asStaff?.invoice.total).toBe(11800);
    expect(asStaff?.invoice.taxTotal).toBe(1800);
    expect(asStaff?.invoice.payments).toHaveLength(1);

    const own = await getInvoiceForPrint(testDb, A, mine);
    expect(own?.customer).toMatchObject({ name: "Snapshot Name", gstin: "GST-SNAP" });
    expect(await getInvoiceForPrint(testDb, A, theirs)).toBeNull();
    expect(await getInvoiceForPrint(testDb, B, mine)).toBeNull();
  });
});

describe("pause / resume / cancel", () => {
  it("pauses an active subscription on a pausable plan via the injected transition", async () => {
    const sub = await mkSub(custA, planId);
    const d = deps();
    const res = await pauseMySubscription(testDb, A, { id: sub }, d);
    expect(res.ok).toBe(true);
    expect(d.calls).toEqual([{ subscriptionId: sub, to: "paused" }]);
  });

  it("refuses to pause when the plan is not pausable", async () => {
    const sub = await mkSub(custA, noPausePlanId);
    const d = deps();
    const res = await pauseMySubscription(testDb, A, { id: sub }, d);
    expect(res.ok).toBe(false);
    expect(d.calls).toHaveLength(0);
  });

  it("resumes only paused, and cancels only when closable", async () => {
    const active = await mkSub(custA, planId);
    const paused = await mkSub(custA, planId, "paused");
    const noClose = await mkSub(custA, noClosePlanId);
    const d = deps();
    expect((await resumeMySubscription(testDb, A, { id: active }, d)).ok).toBe(false);
    expect((await resumeMySubscription(testDb, A, { id: paused }, d)).ok).toBe(true);
    expect((await cancelMySubscription(testDb, A, { id: noClose }, d)).ok).toBe(false);
    expect((await cancelMySubscription(testDb, A, { id: active }, d)).ok).toBe(true);
    expect(d.calls).toEqual([
      { subscriptionId: paused, to: "active" },
      { subscriptionId: active, to: "closed" },
    ]);
  });

  it("cannot act on another customer's subscription", async () => {
    const theirs = await mkSub(custB, planId);
    const d = deps();
    for (const fn of [pauseMySubscription, resumeMySubscription, cancelMySubscription]) {
      const res = await fn(testDb, A, { id: theirs }, d);
      expect(res).toEqual({ ok: false, error: "Not found" });
    }
    expect(d.calls).toHaveLength(0);
  });

  it("rejects staff actors and invalid ids", async () => {
    const sub = await mkSub(custA, planId);
    const d = deps();
    expect((await pauseMySubscription(testDb, STAFF, { id: sub }, d)).ok).toBe(false);
    const bad = await pauseMySubscription(testDb, A, { id: "nope" }, d);
    expect(bad.ok).toBe(false);
    expect(d.calls).toHaveLength(0);
  });
});
