import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  customers,
  discountProducts,
  discountRedemptions,
  discounts,
  invoiceLines,
  invoices,
  paymentTerms,
  plans,
  productTaxes,
  products,
  subscriptionLines,
  subscriptions,
  taxes,
  user,
  billingRuns,
} from "@/db/schema";
import type { DB } from "@/db/client";
import { closeTestDb, testDb, truncateAll } from "@/test/db";
import type { DiscountRule } from "@/server/pricing";
import { previewBilling, runBilling, type BillingDeps } from ".";

const db = testDb as unknown as DB;
const actor = { id: "u1", role: "admin" as const };

/** Simple stand-ins for lane C's functions, backed by the discounts tables. */
const deps: BillingDeps = {
  async listApplicableDiscounts(d, { on }) {
    const rows = await d.select().from(discounts).where(eq(discounts.active, true));
    const links = await d.select().from(discountProducts);
    return rows
      .filter((r) => (!r.startsOn || r.startsOn <= on) && (!r.endsOn || r.endsOn >= on))
      .filter((r) => r.usageLimit === null || r.usedCount < r.usageLimit)
      .map<DiscountRule>((r) => ({
        ...r,
        productIds: links.filter((l) => l.discountId === r.id).map((l) => l.productId),
      }));
  },
  async redeemDiscounts(tx, invoiceId, applied) {
    const failed: string[] = [];
    for (const a of applied) {
      const res = await tx.execute(sql`
        update discounts set used_count = used_count + 1
        where id = ${a.discountId} and (usage_limit is null or used_count < usage_limit)
        returning id`);
      if (res.length === 0) {
        failed.push(a.discountId);
        continue;
      }
      await tx.insert(discountRedemptions).values({ discountId: a.discountId, invoiceId, amount: a.amount });
    }
    return failed;
  },
  async closeSubscription(tx, id) {
    // The real one goes through the state machine; the fake just closes the row.
    await tx.execute(sql`update subscriptions set status = 'closed', next_invoice_date = null where id = ${id}`);
  },
};

let productId: string;
let planId: string;
let termId: string;

async function seedBase(opts: { autoClose?: boolean } = {}) {
  await db.insert(user).values({ id: "u1", name: "Admin", email: "admin@x.test", role: "admin" });
  const [p] = await db.insert(products).values({ name: "Seat", salesPrice: 10000 }).returning();
  productId = p.id;
  const [t] = await db.insert(taxes).values({ name: "GST", rateBps: 1800 }).returning();
  await db.insert(productTaxes).values({ productId, taxId: t.id });
  const [pl] = await db
    .insert(plans)
    .values({ name: "Monthly", interval: "monthly", intervalCount: 1, autoClose: opts.autoClose ?? false })
    .returning();
  planId = pl.id;
  const [term] = await db.insert(paymentTerms).values({ name: "Net 15", dueDays: 15 }).returning();
  termId = term.id;
}

let counter = 0;
async function makeSub(o: { next?: string | null; expiry?: string | null; status?: "active" | "paused"; qty?: number } = {}) {
  counter += 1;
  const [c] = await db
    .insert(customers)
    .values({ name: `Cust ${counter}`, email: `c${counter}@x.test`, company: "Co", address: "Addr", gstin: "G" })
    .returning();
  const [s] = await db
    .insert(subscriptions)
    .values({
      number: `SUB-${String(counter).padStart(4, "0")}`,
      customerId: c.id,
      planId,
      status: o.status ?? "active",
      startDate: "2026-01-01",
      expiryDate: o.expiry ?? null,
      nextInvoiceDate: o.next === undefined ? "2026-01-01" : o.next,
      paymentTermId: termId,
    })
    .returning();
  await db
    .insert(subscriptionLines)
    .values({ subscriptionId: s.id, productId, quantity: o.qty ?? 1, unitPrice: 10000 });
  return s;
}

const allInvoices = () => db.select().from(invoices).orderBy(invoices.periodStart, invoices.number);
const subRow = async (id: string) => (await db.select().from(subscriptions).where(eq(subscriptions.id, id)))[0];

beforeEach(async () => {
  await truncateAll();
  counter = 0;
  await seedBase();
});
afterAll(closeTestDb);

describe("runBilling", () => {
  it("creates invoices with correct totals and snapshots, and advances next_invoice_date", async () => {
    const a = await makeSub({ qty: 2 });
    const b = await makeSub({ next: "2026-01-15" });
    await makeSub({ next: "2026-02-01" }); // not due
    await makeSub({ status: "paused" }); // not active

    const r = await runBilling(db, { on: "2026-01-20", actor }, deps);
    expect(r.created).toHaveLength(2);
    expect(r.created.map((c) => c.number)).toEqual(["INV-0001", "INV-0002"]);

    const [invA] = await db.select().from(invoices).where(eq(invoices.subscriptionId, a.id));
    expect(invA).toMatchObject({
      status: "draft",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      issuedOn: "2026-01-20",
      dueDate: "2026-02-04",
      subtotal: 20000,
      taxTotal: 3600,
      total: 23600,
    });
    expect(invA.customerSnapshot).toMatchObject({ name: "Cust 1", company: "Co", gstin: "G" });
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invA.id));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ description: "Seat", quantity: 2, unitPrice: 10000, taxRateBps: 1800, taxAmount: 3600, lineTotal: 23600 });

    expect((await subRow(a.id)).nextInvoiceDate).toBe("2026-02-01");
    expect((await subRow(b.id)).nextInvoiceDate).toBe("2026-02-15");

    const [run] = await db.select().from(billingRuns).where(eq(billingRuns.id, r.runId));
    expect(run).toMatchObject({ runDate: "2026-01-20", createdCount: 2, startedBy: "u1" });
  });

  it("is idempotent: running twice creates nothing new", async () => {
    await makeSub();
    await makeSub();
    const first = await runBilling(db, { on: "2026-01-10", actor }, deps);
    expect(first.created).toHaveLength(2);
    const second = await runBilling(db, { on: "2026-01-10", actor }, deps);
    expect(second.created).toHaveLength(0);
    expect(await allInvoices()).toHaveLength(2);
  });

  it("two concurrent runs still produce one invoice per period", async () => {
    await makeSub();
    await makeSub();
    await makeSub();
    const [r1, r2] = await Promise.all([
      runBilling(db, { on: "2026-01-10", actor }, deps),
      runBilling(db, { on: "2026-01-10", actor }, deps),
    ]);
    expect(r1.created.length + r2.created.length).toBe(3);
    const rows = await allInvoices();
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((i) => `${i.subscriptionId}|${i.periodStart}`)).size).toBe(3);
  });

  it("catches up several missed periods, one invoice each", async () => {
    const s = await makeSub({ next: "2026-01-01" });
    const r = await runBilling(db, { on: "2026-03-15", actor }, deps);
    expect(r.created).toHaveLength(3);
    const rows = await allInvoices();
    expect(rows.map((i) => i.periodStart)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect((await subRow(s.id)).nextInvoiceDate).toBe("2026-04-01");
  });

  it("caps catch-up at 24 periods per run", async () => {
    const s = await makeSub({ next: "2020-01-01" });
    const r = await runBilling(db, { on: "2026-01-01", actor }, deps);
    expect(r.created).toHaveLength(24);
    expect((await subRow(s.id)).nextInvoiceDate).toBe("2022-01-01");
  });

  it("auto-closes at expiry when the plan allows", async () => {
    await db.update(plans).set({ autoClose: true }).where(eq(plans.id, planId));
    const s = await makeSub({ next: "2026-01-01", expiry: "2026-01-31" });
    await runBilling(db, { on: "2026-01-05", actor }, deps);
    const row = await subRow(s.id);
    expect(row.status).toBe("closed");
    expect(row.nextInvoiceDate).toBeNull();
    expect(await allInvoices()).toHaveLength(1);
  });

  it("clears next_invoice_date at expiry when the plan does not auto-close", async () => {
    const s = await makeSub({ next: "2026-01-01", expiry: "2026-01-31" });
    await runBilling(db, { on: "2026-01-05", actor }, deps);
    const row = await subRow(s.id);
    expect(row.status).toBe("active");
    expect(row.nextInvoiceDate).toBeNull();
  });

  it("restricts to subscriptionIds when given", async () => {
    const a = await makeSub();
    await makeSub();
    const r = await runBilling(db, { on: "2026-01-10", actor, subscriptionIds: [a.id] }, deps);
    expect(r.created.map((c) => c.subscriptionId)).toEqual([a.id]);
  });

  it("applies a usage-limited discount only up to its limit across a run", async () => {
    const [d] = await db
      .insert(discounts)
      .values({ name: "Promo", kind: "fixed", value: 1000, scope: "subscription", usageLimit: 2 })
      .returning();
    const subs = [await makeSub(), await makeSub(), await makeSub()];
    const r = await runBilling(db, { on: "2026-01-10", actor }, deps);
    expect(r.created).toHaveLength(3);

    const rows = await allInvoices();
    expect(rows.filter((i) => i.discountTotal === 1000)).toHaveLength(2);
    expect(rows.filter((i) => i.discountTotal === 0)).toHaveLength(1);
    expect(rows.every((i) => i.total === i.subtotal - i.discountTotal + i.taxTotal)).toBe(true);
    const [after] = await db.select().from(discounts).where(eq(discounts.id, d.id));
    expect(after.usedCount).toBe(2);
    expect(await db.select().from(discountRedemptions)).toHaveLength(2);
    expect(subs).toHaveLength(3);
  });

  it("rebuilds without a discount that fails redemption (stale listing)", async () => {
    const [d] = await db
      .insert(discounts)
      .values({ name: "Promo", kind: "fixed", value: 1000, scope: "subscription", usageLimit: 1, usedCount: 1 })
      .returning();
    await makeSub();
    // listing is stale: still offers the used-up discount, redeem rejects it
    const stale: BillingDeps = {
      ...deps,
      listApplicableDiscounts: async () => [
        {
          id: d.id, name: "Promo", kind: "fixed", value: 1000, scope: "subscription", productIds: [],
          minAmount: null, minQty: null, startsOn: null, endsOn: null, usageLimit: 1, usedCount: 0, active: true,
        },
      ],
    };
    const r = await runBilling(db, { on: "2026-01-10", actor }, stale);
    expect(r.created).toHaveLength(1);
    const [inv] = await allInvoices();
    expect(inv.discountTotal).toBe(0);
    expect(inv.total).toBe(inv.subtotal + inv.taxTotal);
    expect(await db.select().from(discountRedemptions)).toHaveLength(0);
  });

  it("keeps the snapshot unchanged after the product price changes", async () => {
    await makeSub();
    await runBilling(db, { on: "2026-01-10", actor }, deps);
    const before = await db.select().from(invoiceLines);
    await db.update(products).set({ name: "Renamed", salesPrice: 99999 }).where(eq(products.id, productId));
    await db.update(subscriptionLines).set({ unitPrice: 99999 });
    const after = await db.select().from(invoiceLines);
    expect(after).toEqual(before);
    expect(after[0]).toMatchObject({ description: "Seat", unitPrice: 10000 });
  });

  it("does not consume invoice numbers for skipped periods", async () => {
    const s = await makeSub();
    const r1 = await runBilling(db, { on: "2026-01-10", actor }, deps);
    const firstNo = Number(r1.created[0].number.slice(4));
    // force it due again for the same period; the unique key must stop a duplicate
    await db.update(subscriptions).set({ nextInvoiceDate: "2026-01-01" }).where(eq(subscriptions.id, s.id));
    const r = await runBilling(db, { on: "2026-01-10", actor }, deps);
    expect(r.created).toHaveLength(0);
    expect(await allInvoices()).toHaveLength(1);
    expect((await subRow(s.id)).nextInvoiceDate).toBe("2026-02-01");
    const t = await makeSub({ next: "2026-01-02" });
    const r2 = await runBilling(db, { on: "2026-01-10", actor, subscriptionIds: [t.id] }, deps);
    // the skipped duplicate must not have used up a number
    expect(Number(r2.created[0].number.slice(4))).toBe(firstNo + 1);
  });
});

describe("previewBilling", () => {
  it("prices due subscriptions without inserting", async () => {
    await makeSub({ qty: 2 });
    await makeSub({ next: "2026-02-01" });
    const p = await previewBilling(db, "2026-01-10", deps);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ customerName: "Cust 1", periodStart: "2026-01-01", periodEnd: "2026-01-31", subtotal: 20000, total: 23600 });
    expect(p.totals).toMatchObject({ count: 1, total: 23600 });
    expect(await allInvoices()).toHaveLength(0);
  });
});
