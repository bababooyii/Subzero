import { and, asc, desc, eq, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";
import {
  customers,
  invoiceLines,
  invoices,
  payments,
  plans,
  subscriptionLines,
  subscriptions,
  type Invoice,
  type InvoiceLine,
  type Payment,
  type Subscription,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";
import { resolveCustomerId, type Db } from "./scope";

/** Seller block printed on invoices. */
export const COMPANY = {
  name: "Brightloop Technologies Pvt Ltd",
  address: "4th Floor, Prestige Tech Park, Outer Ring Road, Bengaluru 560103",
  gstin: "29AABCB1234F1Z5",
  email: "billing@brightloop.test",
} as const;

type SubStatus = Subscription["status"];
type PlanFlags = { pausable: boolean; closable: boolean };

/** What the portal customer may do to a subscription, from its status and the plan flags. */
export function portalSubscriptionActions(subStatus: SubStatus, plan: PlanFlags) {
  return {
    canPause: subStatus === "active" && plan.pausable,
    canResume: subStatus === "paused",
    canCancel: (subStatus === "active" || subStatus === "paused") && plan.closable,
  };
}

export type MySubscription = Pick<
  Subscription,
  "id" | "number" | "status" | "startDate" | "expiryDate" | "nextInvoiceDate"
> & {
  plan: { id: string; name: string; interval: string; intervalCount: number };
  /** Sum of line quantity x unit price per billing period, pre-tax, paise. */
  recurringAmount: number;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
};

export async function mySubscriptions(db: Db, actor: Actor): Promise<MySubscription[]> {
  const customerId = await resolveCustomerId(db, actor);
  if (!customerId) return [];

  const subs = await db
    .select({ sub: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.customerId, customerId), ne(subscriptions.status, "draft")))
    .orderBy(desc(subscriptions.startDate), desc(subscriptions.number));
  if (subs.length === 0) return [];

  const totals = await db
    .select({
      subscriptionId: subscriptionLines.subscriptionId,
      amount: sql<number>`coalesce(sum(${subscriptionLines.quantity} * ${subscriptionLines.unitPrice}), 0)::int`,
    })
    .from(subscriptionLines)
    .where(
      inArray(
        subscriptionLines.subscriptionId,
        subs.map((s) => s.sub.id),
      ),
    )
    .groupBy(subscriptionLines.subscriptionId);
  const amountBySub = new Map(totals.map((t) => [t.subscriptionId, Number(t.amount)]));

  return subs.map(({ sub, plan }) => {
    const { id, number, status, startDate, expiryDate, nextInvoiceDate } = sub;
    return {
      id,
      number,
      status,
      startDate,
      expiryDate,
      nextInvoiceDate,
      plan: { id: plan.id, name: plan.name, interval: plan.interval, intervalCount: plan.intervalCount },
      recurringAmount: amountBySub.get(id) ?? 0,
      ...portalSubscriptionActions(status, plan),
    };
  });
}

export type MyInvoiceRow = Pick<
  Invoice,
  | "id"
  | "number"
  | "subscriptionId"
  | "status"
  | "issuedOn"
  | "dueDate"
  | "periodStart"
  | "periodEnd"
  | "total"
  | "amountPaid"
> & { balance: number };

const SORTS = {
  number: invoices.number,
  issuedOn: invoices.issuedOn,
  dueDate: invoices.dueDate,
  total: invoices.total,
} as const;

/** Customers never see draft invoices. */
const visibleTo = (customerId: string): SQL =>
  and(eq(invoices.customerId, customerId), ne(invoices.status, "draft"))!;

export async function myInvoices(
  db: Db,
  actor: Actor,
  params: ListParams = {},
): Promise<Paged<MyInvoiceRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const customerId = await resolveCustomerId(db, actor);
  if (!customerId) return { rows: [], total: 0, page, pageSize };

  const q = params.q?.trim();
  const where = q
    ? and(visibleTo(customerId), ilike(invoices.number, `%${q.replace(/[%_\\]/g, "\\$&")}%`))
    : visibleTo(customerId);
  const sortCol = SORTS[params.sort as keyof typeof SORTS] ?? invoices.issuedOn;
  const order = params.dir === "asc" ? asc : desc;

  const [rows, [count]] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(where)
      .orderBy(order(sortCol), desc(invoices.number))
      .limit(limit)
      .offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(invoices).where(where),
  ]);

  return {
    rows: rows.map((r) => {
      const { id, number, subscriptionId, status, issuedOn, dueDate, periodStart, periodEnd, total, amountPaid } = r;
      return {
        id, number, subscriptionId, status, issuedOn, dueDate, periodStart, periodEnd, total, amountPaid,
        balance: total - amountPaid,
      };
    }),
    total: Number(count?.n ?? 0),
    page,
    pageSize,
  };
}

export type MyInvoiceDetail = MyInvoiceRow & {
  lines: InvoiceLine[];
  payments: Payment[];
};

async function loadDetail(db: Db, inv: Invoice): Promise<MyInvoiceDetail> {
  const [lines, pays] = await Promise.all([
    db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, inv.id)).orderBy(asc(invoiceLines.description)),
    db.select().from(payments).where(eq(payments.invoiceId, inv.id)).orderBy(asc(payments.paidOn), asc(payments.createdAt)),
  ]);
  const { id, number, subscriptionId, status, issuedOn, dueDate, periodStart, periodEnd, total, amountPaid } = inv;
  return {
    id, number, subscriptionId, status, issuedOn, dueDate, periodStart, periodEnd, total, amountPaid,
    balance: total - amountPaid,
    lines,
    payments: pays,
  };
}

/** Null (404-style) for an unknown id or someone else's invoice. */
export async function getMyInvoice(db: Db, actor: Actor, id: string): Promise<MyInvoiceDetail | null> {
  const customerId = await resolveCustomerId(db, actor);
  if (!customerId || !isUuid(id)) return null;
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), visibleTo(customerId)))
    .limit(1);
  return inv ? loadDetail(db, inv) : null;
}

export type InvoicePrintData = {
  company: typeof COMPANY;
  customer: { name: string; email: string; company: string | null; address: string | null; gstin: string | null };
  invoice: MyInvoiceDetail & {
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    sentAt: string | null;
  };
};

/** Everything the print view needs. Staff/admin: any invoice. Customer: only their own, non-draft. */
export async function getInvoiceForPrint(db: Db, actor: Actor, id: string): Promise<InvoicePrintData | null> {
  if (!isUuid(id)) return null;
  let inv: Invoice | undefined;
  if (actor.role === "customer") {
    const customerId = await resolveCustomerId(db, actor);
    if (!customerId) return null;
    [inv] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), visibleTo(customerId)))
      .limit(1);
  } else if (actor.role === "admin" || actor.role === "staff") {
    [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  }
  if (!inv) return null;

  const [cust] = await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1);
  // Prefer the snapshot taken at invoicing time; fall back to the live customer row.
  const snap = (inv.customerSnapshot ?? {}) as Record<string, string | null | undefined>;
  const detail = await loadDetail(db, inv);
  return {
    company: COMPANY,
    customer: {
      name: snap.name ?? cust?.name ?? "",
      email: snap.email ?? cust?.email ?? "",
      company: snap.company ?? cust?.company ?? null,
      address: snap.address ?? cust?.address ?? null,
      gstin: snap.gstin ?? cust?.gstin ?? null,
    },
    invoice: {
      ...detail,
      subtotal: inv.subtotal,
      discountTotal: inv.discountTotal,
      taxTotal: inv.taxTotal,
      sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
    },
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}
