import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import {
  customers,
  paymentTerms,
  productTaxes,
  productVariants,
  products,
  subscriptionLines,
  subscriptions,
  taxes,
} from "@/db/schema";
import { listApplicableDiscounts } from "@/features/discounts/queries";
import { myInvoices, mySubscriptions } from "@/features/portal/queries";
import { resolveCustomerId } from "@/features/portal/scope";
import { ForbiddenError, requireActor, UnauthorizedError, type Actor } from "@/lib/auth/session";
import { type Interval } from "@/lib/dates";
import { requestToday } from "@/lib/request-today";
import { listActivity } from "@/server/activity-log";
import { price } from "@/server/pricing";
import type {
  PortalCustomer,
  PortalData,
  PortalEvent,
  PortalInvoice,
  PortalInvoiceStatus,
  PortalLine,
  PortalSub,
} from "./types";

/** The signed-in customer. Anyone else is sent away (the layout does the same; pages render alongside it). */
export async function portalActor(): Promise<Actor> {
  try {
    return await requireActor("customer");
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    if (err instanceof ForbiddenError) redirect("/dashboard");
    throw err;
  }
}

const STATUS_ORDER: Record<string, number> = { quotation: 0, active: 1, paused: 2, confirmed: 3, draft: 4, closed: 5 };

/** Overdue and partial are display states derived from a confirmed invoice. */
function displayStatus(status: string, balance: number, amountPaid: number, dueDate: string, today: string): PortalInvoiceStatus {
  if (status === "confirmed") {
    if (balance > 0 && dueDate < today) return "overdue";
    if (amountPaid > 0) return "partial";
  }
  return status as PortalInvoiceStatus;
}

async function loadCustomer(actor: Actor): Promise<PortalCustomer | null> {
  const customerId = await resolveCustomerId(db, actor);
  if (!customerId) return null;
  const [row] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.company ?? row.name,
    contactName: row.name,
    email: row.email,
    phone: row.phone ?? "",
    address: row.address ?? "",
    gstin: row.gstin ?? "",
    createdAt: row.createdAt.toISOString(),
  };
}

/** Lines, tax rates, discounts and payment terms for all the customer's subscriptions, in a handful of queries. */
async function decorate(subs: Awaited<ReturnType<typeof mySubscriptions>>, today: string): Promise<PortalSub[]> {
  if (subs.length === 0) return [];
  const subIds = subs.map((s) => s.id);

  const [lineRows, metaRows] = await Promise.all([
    db
      .select({
        id: subscriptionLines.id,
        subscriptionId: subscriptionLines.subscriptionId,
        productId: subscriptionLines.productId,
        productName: products.name,
        variantLabel: sql<string | null>`case when ${productVariants.id} is null then null else ${productVariants.attribute} || ': ' || ${productVariants.value} end`,
        quantity: subscriptionLines.quantity,
        unitPrice: subscriptionLines.unitPrice,
      })
      .from(subscriptionLines)
      .innerJoin(products, eq(products.id, subscriptionLines.productId))
      .leftJoin(productVariants, eq(productVariants.id, subscriptionLines.variantId))
      .where(inArray(subscriptionLines.subscriptionId, subIds))
      .orderBy(asc(subscriptionLines.id)),
    db
      .select({
        id: subscriptions.id,
        quotationValidUntil: subscriptions.quotationValidUntil,
        paymentTerms: paymentTerms.name,
      })
      .from(subscriptions)
      .leftJoin(paymentTerms, eq(paymentTerms.id, subscriptions.paymentTermId))
      .where(inArray(subscriptions.id, subIds)),
  ]);

  const productIds = [...new Set(lineRows.map((l) => l.productId))];
  const [rates, discounts] = await Promise.all([
    productIds.length
      ? db
          .select({ productId: productTaxes.productId, rateBps: taxes.rateBps })
          .from(productTaxes)
          .innerJoin(taxes, eq(taxes.id, productTaxes.taxId))
          .where(and(inArray(productTaxes.productId, productIds), eq(taxes.active, true)))
      : [],
    listApplicableDiscounts(db, { productIds, on: today }),
  ]);
  const bpsByProduct = new Map<string, number[]>();
  for (const r of rates) bpsByProduct.set(r.productId, [...(bpsByProduct.get(r.productId) ?? []), r.rateBps]);
  const meta = new Map(metaRows.map((m) => [m.id, m]));

  return subs.map((s) => {
    const own = lineRows.filter((l) => l.subscriptionId === s.id);
    const priced = price({
      lines: own.map((l) => ({
        key: l.id,
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRatesBps: bpsByProduct.get(l.productId) ?? [],
      })),
      discounts,
      on: today,
    });
    const lines: PortalLine[] = own.map((l) => ({
      id: l.id,
      description: l.productName,
      variant: l.variantLabel ?? undefined,
      qty: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: (bpsByProduct.get(l.productId) ?? []).reduce((n, b) => n + b, 0) / 100,
      amount: l.quantity * l.unitPrice,
    }));
    const m = meta.get(s.id);
    return {
      id: s.id,
      number: s.number,
      status: s.status,
      planName: s.plan.name,
      interval: s.plan.interval as Interval,
      intervalCount: s.plan.intervalCount,
      canPause: s.canPause,
      canResume: s.canResume,
      canCancel: s.canCancel,
      startDate: s.startDate,
      expiryDate: s.expiryDate,
      quotationValidUntil: m?.quotationValidUntil ?? null,
      nextBillingDate: s.nextInvoiceDate,
      paymentTerms: m?.paymentTerms ?? "Immediate payment",
      amount: priced.total,
      totals: {
        subtotal: priced.subtotal,
        discountTotal: priced.discountTotal,
        taxTotal: priced.taxTotal,
        total: priced.total,
      },
      lines,
    };
  });
}

/**
 * Everything the portal renders, for the signed-in customer. Cached per request so the layout (provider)
 * and the page share one load. Invoices are the newest 200 (the backend page-size cap).
 */
export const loadPortalData = cache(async (actorId: string, today: string): Promise<PortalData | null> => {
  const actor: Actor = { id: actorId, role: "customer" };
  const customer = await loadCustomer(actor);
  if (!customer) return null;

  const [mine, invoicePage] = await Promise.all([
    mySubscriptions(db, actor),
    myInvoices(db, actor, { pageSize: 200, sort: "issuedOn", dir: "desc" }),
  ]);
  const subs = (await decorate(mine, today)).sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.number.localeCompare(b.number),
  );
  const numberById = new Map(subs.map((s) => [s.id, s.number]));

  const invoices: PortalInvoice[] = invoicePage.rows.map((i) => {
    const balance = i.status === "cancelled" ? 0 : Math.max(0, i.balance);
    return {
      id: i.id,
      number: i.number,
      subscriptionId: i.subscriptionId,
      subscriptionNumber: numberById.get(i.subscriptionId) ?? "",
      issueDate: i.issuedOn,
      dueDate: i.dueDate,
      periodStart: i.periodStart,
      periodEnd: i.periodEnd,
      status: displayStatus(i.status, balance, i.amountPaid, i.dueDate, today),
      total: i.total,
      balance,
    };
  });

  return { customer, today, subs, invoices };
});

/** The signed-in customer's data, or a redirect when there is no session. */
export async function getPortalData(): Promise<PortalData> {
  const actor = await portalActor();
  const data = await loadPortalData(actor.id, (await requestToday()));
  // A customer login with no linked customer row has nothing to show.
  if (!data) redirect("/login");
  return data;
}

const EVENT_TEXT: Record<string, string> = {
  quotation: "Quotation sent",
  confirmed: "Quotation accepted",
  active: "Subscription active",
  paused: "Subscription paused",
  closed: "Subscription closed",
};

/** The subscription's recent history in customer-friendly words (no staff names). Newest first, 8 at most. */
export async function loadSubscriptionEvents(id: string): Promise<PortalEvent[]> {
  const items = await listActivity(db, "subscription", id);
  return items.slice(0, 8).map((e, n) => ({
    id: `${id}-${n}`,
    at: e.at.toISOString(),
    text: (e.toStatus && EVENT_TEXT[e.toStatus]) || (e.action === "created" ? "Subscription created" : `Subscription ${e.action.replace(/_/g, " ")}`),
  }));
}
