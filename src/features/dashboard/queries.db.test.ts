import { beforeEach, describe, expect, it } from "vitest";
import { testDb, truncateAll } from "@/test/db";
import {
  activityLog,
  customers,
  invoices,
  payments,
  plans,
  products,
  subscriptionLines,
  subscriptions,
} from "@/db/schema";
import {
  dashboardKpis,
  navCounts,
  overdueAgeing,
  overdueInvoices,
  revenueByMonth,
} from "./queries";

const TODAY = "2026-10-31";

let customerId: string;
let n = 0;

async function addPlan(interval: "daily" | "weekly" | "monthly" | "yearly", intervalCount = 1) {
  const [p] = await testDb.insert(plans).values({ name: `${interval}${intervalCount}`, interval, intervalCount }).returning();
  return p!.id;
}

async function addSub(
  planId: string,
  opts: { status?: "active" | "paused" | "closed" | "draft"; start?: string; unitPrice: number; qty?: number; next?: string | null },
) {
  const [s] = await testDb
    .insert(subscriptions)
    .values({
      number: `SUB-${++n}`,
      customerId,
      planId,
      status: opts.status ?? "active",
      startDate: opts.start ?? "2026-01-01",
      nextInvoiceDate: opts.next ?? null,
    })
    .returning();
  const [prod] = await testDb.insert(products).values({ name: `P${n}` }).returning();
  await testDb.insert(subscriptionLines).values({
    subscriptionId: s!.id,
    productId: prod!.id,
    quantity: opts.qty ?? 1,
    unitPrice: opts.unitPrice,
  });
  return s!.id;
}

async function addInvoice(
  subId: string,
  o: { issuedOn: string; dueDate: string; total: number; paid?: number; status?: "confirmed" | "paid" | "cancelled" },
) {
  const [i] = await testDb
    .insert(invoices)
    .values({
      number: `INV-${++n}`,
      subscriptionId: subId,
      customerId,
      customerSnapshot: {},
      periodStart: o.issuedOn,
      periodEnd: o.issuedOn,
      status: o.status ?? "confirmed",
      issuedOn: o.issuedOn,
      dueDate: o.dueDate,
      total: o.total,
      amountPaid: o.paid ?? 0,
    })
    .returning();
  return i!.id;
}

beforeEach(async () => {
  await truncateAll();
  n = 0;
  const [c] = await testDb.insert(customers).values({ name: "Acme", email: "a@x.test" }).returning();
  customerId = c!.id;
});

describe("dashboardKpis", () => {
  it("normalises MRR per interval and excludes paused/draft", async () => {
    const monthly = await addPlan("monthly");
    const quarterly = await addPlan("monthly", 3);
    const yearly = await addPlan("yearly");
    const weekly = await addPlan("weekly");
    const daily = await addPlan("daily");
    await addSub(monthly, { unitPrice: 10000, qty: 2 }); // 20000
    await addSub(quarterly, { unitPrice: 30000 }); // 10000
    await addSub(yearly, { unitPrice: 120000 }); // 10000
    await addSub(weekly, { unitPrice: 1000 }); // 4333
    await addSub(daily, { unitPrice: 100 }); // 3000
    await addSub(monthly, { unitPrice: 99999, status: "paused" });
    await addSub(monthly, { unitPrice: 99999, status: "draft" });

    const k = await dashboardKpis(testDb, { from: "2026-10-01", to: TODAY, today: TODAY });
    expect(k.activeSubscriptions).toBe(5);
    expect(k.mrr).toBe(47333);
  });

  it("filters by plan", async () => {
    const monthly = await addPlan("monthly");
    const yearly = await addPlan("yearly");
    await addSub(monthly, { unitPrice: 5000 });
    await addSub(yearly, { unitPrice: 12000 });
    const k = await dashboardKpis(testDb, { from: "2026-10-01", to: TODAY, planId: yearly, today: TODAY });
    expect(k.activeSubscriptions).toBe(1);
    expect(k.mrr).toBe(1000);
  });

  it("sums collected, outstanding, overdue and period deltas", async () => {
    const plan = await addPlan("monthly");
    const sub = await addSub(plan, { unitPrice: 1000 });
    const paid = await addInvoice(sub, { issuedOn: "2026-09-01", dueDate: "2026-09-15", total: 5000, paid: 5000, status: "paid" });
    const partial = await addInvoice(sub, { issuedOn: "2026-10-01", dueDate: "2026-10-10", total: 8000, paid: 3000 });
    await addInvoice(sub, { issuedOn: "2026-10-20", dueDate: "2026-11-20", total: 2000 }); // not yet due
    await addInvoice(sub, { issuedOn: "2026-08-01", dueDate: "2026-08-10", total: 9999, status: "cancelled" });
    await testDb.insert(payments).values([
      { invoiceId: paid, method: "upi", amount: 5000, paidOn: "2026-09-20" }, // previous period
      { invoiceId: partial, method: "card", amount: 3000, paidOn: "2026-10-12" },
    ]);

    // period Oct 1..Oct 31 (31 days); previous = Aug 31..Sep 30
    const k = await dashboardKpis(testDb, { from: "2026-10-01", to: TODAY, today: TODAY });
    expect(k.collected).toBe(3000);
    expect(k.deltas.collected).toBe(-40);
    expect(k.outstanding).toBe(5000 + 2000);
    expect(k.overdue).toEqual({ count: 1, amount: 5000 });
  });

  it("uses the activity log to place subscriptions in the previous period", async () => {
    const plan = await addPlan("monthly");
    const stays = await addSub(plan, { unitPrice: 1000, start: "2026-01-01" });
    const closed = await addSub(plan, { unitPrice: 1000, start: "2026-01-01", status: "closed" });
    await testDb.insert(activityLog).values({
      entityType: "subscription", entityId: closed, action: "status_change",
      fromStatus: "active", toStatus: "closed", at: new Date("2026-10-15T10:00:00Z"),
    });
    expect(stays).toBeTruthy();
    const k = await dashboardKpis(testDb, { from: "2026-10-01", to: TODAY, today: TODAY });
    expect(k.activeSubscriptions).toBe(1); // closed on Oct 15
    expect(k.deltas.activeSubscriptions).toBe(-50); // 2 active on Sep 30
    const mid = await dashboardKpis(testDb, { from: "2026-10-01", to: "2026-10-10", today: TODAY });
    expect(mid.activeSubscriptions).toBe(2);
  });

  it("returns null deltas when the previous period is empty", async () => {
    const k = await dashboardKpis(testDb, { from: "2026-10-01", to: TODAY, today: TODAY });
    expect(k.deltas).toEqual({ activeSubscriptions: null, mrr: null, collected: null });
    expect(k.mrr).toBe(0);
  });
});

describe("revenueByMonth", () => {
  it("zero-fills months and sums invoiced/collected", async () => {
    const plan = await addPlan("monthly");
    const sub = await addSub(plan, { unitPrice: 1000 });
    const inv = await addInvoice(sub, { issuedOn: "2026-08-05", dueDate: "2026-08-20", total: 7000, paid: 7000, status: "paid" });
    await addInvoice(sub, { issuedOn: "2026-10-05", dueDate: "2026-11-05", total: 3000 });
    await addInvoice(sub, { issuedOn: "2026-10-06", dueDate: "2026-11-05", total: 500, status: "cancelled" });
    await testDb.insert(payments).values({ invoiceId: inv, method: "upi", amount: 7000, paidOn: "2026-09-02" });

    const r = await revenueByMonth(testDb, { months: 4, today: TODAY });
    expect(r).toEqual([
      { month: "2026-07", invoiced: 0, collected: 0 },
      { month: "2026-08", invoiced: 7000, collected: 0 },
      { month: "2026-09", invoiced: 0, collected: 7000 },
      { month: "2026-10", invoiced: 3000, collected: 0 },
    ]);
    expect(await revenueByMonth(testDb, { today: TODAY })).toHaveLength(12);
  });
});

describe("overdue lists", () => {
  beforeEach(async () => {
    const plan = await addPlan("monthly");
    const sub = await addSub(plan, { unitPrice: 1000, next: TODAY });
    await addInvoice(sub, { issuedOn: "2026-10-01", dueDate: "2026-10-21", total: 1000 }); // 10 days
    await addInvoice(sub, { issuedOn: "2026-08-01", dueDate: "2026-09-21", total: 2000, paid: 500 }); // 40 days
    await addInvoice(sub, { issuedOn: "2026-06-01", dueDate: "2026-07-01", total: 3000 }); // 122 days
    await addInvoice(sub, { issuedOn: "2026-09-01", dueDate: "2026-10-01", total: 400 }); // 30 days -> 0-30
    await addInvoice(sub, { issuedOn: "2026-05-01", dueDate: "2026-05-01", total: 800, status: "paid", paid: 800 });
    await addInvoice(sub, { issuedOn: "2026-10-30", dueDate: "2026-11-30", total: 123 }); // not due
  });

  it("buckets balances by days overdue", async () => {
    expect(await overdueAgeing(testDb, { today: TODAY })).toEqual([
      { bucket: "0-30", count: 2, amount: 1400 },
      { bucket: "31-60", count: 1, amount: 1500 },
      { bucket: "60+", count: 1, amount: 3000 },
    ]);
  });

  it("lists the most overdue first with balances and limit", async () => {
    const list = await overdueInvoices(testDb, { limit: 2, today: TODAY });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ customerName: "Acme", dueDate: "2026-07-01", daysOverdue: 122, balance: 3000 });
    expect(list[1]).toMatchObject({ dueDate: "2026-09-21", daysOverdue: 40, balance: 1500 });
  });

  it("returns zero-filled ageing when nothing is overdue", async () => {
    await truncateAll();
    expect(await overdueAgeing(testDb, { today: TODAY })).toEqual([
      { bucket: "0-30", count: 0, amount: 0 },
      { bucket: "31-60", count: 0, amount: 0 },
      { bucket: "60+", count: 0, amount: 0 },
    ]);
  });
});

describe("navCounts", () => {
  it("counts subscriptions due to bill and overdue invoices", async () => {
    const plan = await addPlan("monthly");
    const due = await addSub(plan, { unitPrice: 1, next: TODAY });
    await addSub(plan, { unitPrice: 1, next: "2026-11-05" });
    await addSub(plan, { unitPrice: 1, status: "paused", next: TODAY });
    await addInvoice(due, { issuedOn: "2026-09-01", dueDate: "2026-09-10", total: 10 });
    await addInvoice(due, { issuedOn: "2026-10-01", dueDate: "2026-11-10", total: 10 });
    expect(await navCounts(testDb, TODAY)).toEqual({ dueToday: 1, overdueInvoices: 1 });
  });
});
