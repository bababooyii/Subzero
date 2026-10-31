import { desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { customers, invoices, paymentTerms, payments, plans, subscriptions } from "@/db/schema";
import { previewBillingAction } from "@/features/billing/actions";
import { displayStatusOf } from "@/features/invoices/queries";
import { addDays, todayIST } from "@/lib/dates";
import type { DraftContext, DraftInvoice } from "@/components/billing/draft";

const firstLine = (s: string | null) => s?.split(/\r?\n/)[0]?.trim() ?? "";

/**
 * The billing-run deck: `previewBillingAction()` (every due subscription period, priced, nothing inserted) plus the
 * subscription and customer context shown beside each card. Context is loaded in a handful of batched queries.
 */
export async function loadDrafts(): Promise<{ drafts: DraftInvoice[]; error: string | null }> {
  const preview = await previewBillingAction();
  if (!preview.ok) return { drafts: [], error: preview.error };
  const rows = preview.data.rows;
  if (rows.length === 0) return { drafts: [], error: null };

  const today = todayIST();
  const subIds = [...new Set(rows.map((r) => r.subscriptionId))];

  const subs = await db
    .select({
      id: subscriptions.id,
      startDate: subscriptions.startDate,
      customerId: subscriptions.customerId,
      planName: plans.name,
      interval: plans.interval,
      company: customers.company,
      address: customers.address,
      termsName: paymentTerms.name,
      dueDays: paymentTerms.dueDays,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(customers, eq(customers.id, subscriptions.customerId))
    .leftJoin(paymentTerms, eq(paymentTerms.id, subscriptions.paymentTermId))
    .where(inArray(subscriptions.id, subIds));
  const subById = new Map(subs.map((s) => [s.id, s]));
  const customerIds = [...new Set(subs.map((s) => s.customerId))];

  const unpaidDue = sql`${invoices.status} = 'confirmed' and ${invoices.dueDate} < ${today}::date and ${invoices.amountPaid} < ${invoices.total}`;
  const [agg, lastPays, ranked] = await Promise.all([
    db
      .select({
        subscriptionId: invoices.subscriptionId,
        issued: sql<number>`count(*)::int`,
        open: sql<number>`coalesce(sum(case when ${invoices.status} = 'confirmed' then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)::float8`,
        overdueBalance: sql<number>`coalesce(sum(case when ${unpaidDue} then ${invoices.total} - ${invoices.amountPaid} else 0 end), 0)::float8`,
        overdueCount: sql<number>`(count(*) filter (where ${unpaidDue}))::int`,
      })
      .from(invoices)
      .where(inArray(invoices.subscriptionId, subIds))
      .groupBy(invoices.subscriptionId),
    db
      .selectDistinctOn([invoices.subscriptionId], {
        subscriptionId: invoices.subscriptionId,
        paidOn: payments.paidOn,
        amount: payments.amount,
        method: payments.method,
      })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(inArray(invoices.subscriptionId, subIds))
      .orderBy(invoices.subscriptionId, desc(payments.paidOn), desc(payments.createdAt)),
    recentInvoices(customerIds),
  ]);
  const aggBySub = new Map(agg.map((a) => [a.subscriptionId, a]));
  const payBySub = new Map(lastPays.map((p) => [p.subscriptionId, p]));

  const drafts: DraftInvoice[] = [];
  for (const r of rows) {
    const s = subById.get(r.subscriptionId);
    if (!s) continue;
    const a = aggBySub.get(r.subscriptionId);
    const p = payBySub.get(r.subscriptionId);
    const key = `${r.subscriptionId}:${r.periodStart}`;
    const discountName = r.appliedDiscounts.map((d) => d.name).join(", ") || "Discount";
    const context: DraftContext = {
      planName: s.planName,
      interval: s.interval,
      startDate: s.startDate,
      invoicesIssued: a?.issued ?? 0,
      lastPayment: p ? { date: p.paidOn, amount: p.amount, method: p.method } : null,
      openBalance: a?.open ?? 0,
      overdueBalance: a?.overdueBalance ?? 0,
      overdueCount: a?.overdueCount ?? 0,
      recentInvoices: ranked.get(s.customerId) ?? [],
    };
    drafts.push({
      id: key,
      invoiceNumber: r.number,
      subscriptionId: r.subscriptionId,
      subscriptionNumber: r.subscriptionNumber,
      customerId: s.customerId,
      customerName: r.customerName,
      location: s.company?.trim() || firstLine(s.address),
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      // Invoices are issued today (the run date), so the due date is today plus the payment term.
      dueDate: addDays(today, s.dueDays ?? 0),
      paymentTerms: s.termsName ?? "Immediate",
      lines: r.lines.map((l, i) => ({
        id: `${key}:${i}`,
        description: l.variantLabel ? `${l.description} · ${l.variantLabel}` : l.description,
        qty: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discountAmount,
        discountName: l.discountAmount > 0 ? discountName : null,
        taxRate: l.taxRateBps / 100,
      })),
      subtotal: r.subtotal,
      discountTotal: r.discountTotal,
      taxTotal: r.taxTotal,
      total: r.total,
      context,
    });
  }
  return { drafts, error: null };
}

/** Each customer's three latest invoices, newest first. */
async function recentInvoices(customerIds: string[]) {
  const out = new Map<string, DraftContext["recentInvoices"]>();
  if (customerIds.length === 0) return out;
  const ranked = db
    .select({
      id: invoices.id,
      customerId: invoices.customerId,
      number: invoices.number,
      issuedOn: invoices.issuedOn,
      dueDate: invoices.dueDate,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      status: invoices.status,
      rn: sql<number>`row_number() over (partition by ${invoices.customerId} order by ${invoices.issuedOn} desc, ${invoices.number} desc)`.as("rn"),
    })
    .from(invoices)
    .where(inArray(invoices.customerId, customerIds))
    .as("ranked");
  const rows = await db.select().from(ranked).where(lte(ranked.rn, 3)).orderBy(desc(ranked.issuedOn), desc(ranked.number));
  const today = todayIST();
  for (const i of rows) {
    const list = out.get(i.customerId) ?? [];
    list.push({
      id: i.id,
      number: i.number,
      issueDate: i.issuedOn,
      total: i.total,
      status: displayStatusOf(i, today),
    });
    out.set(i.customerId, list);
  }
  return out;
}
