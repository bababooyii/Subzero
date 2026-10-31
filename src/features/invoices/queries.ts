import { and, asc, desc, eq, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import {
  customers,
  invoiceLines,
  invoices,
  payments,
  subscriptions,
} from "@/db/schema";
import { containsPattern } from "@/features/catalog/queries";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";
import { availableActions, type InvoiceDeps } from "./service";
import type {
  InvoiceDisplayStatus,
  InvoiceStatus,
  InvoiceView,
} from "./schemas";

type Db = DB | Tx;

export type InvoiceRow = {
  id: string;
  number: string;
  customerName: string;
  subscriptionNumber: string;
  issuedOn: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  displayStatus: InvoiceDisplayStatus;
} & Pick<typeof invoices.$inferSelect, "status">;

export type ListInvoicesParams = ListParams & {
  status?: InvoiceStatus;
  view?: InvoiceView;
  customerId?: string;
  subscriptionId?: string;
  /** "YYYY-MM-DD"; reference date for overdue. */
  today: string;
};

export function displayStatusOf(
  inv: { total: number; amountPaid: number; dueDate: string } & Pick<
    InvoiceRow,
    "status"
  >,
  today: string,
): InvoiceDisplayStatus {
  const { status } = inv;
  if (status !== "confirmed") return status;
  if (inv.dueDate < today && inv.amountPaid < inv.total) return "overdue";
  if (inv.amountPaid > 0 && inv.amountPaid < inv.total) return "partially_paid";
  return status;
}

export async function listInvoices(
  db: Db,
  params: ListInvoicesParams,
): Promise<Paged<InvoiceRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const conds: SQL[] = [];
  const q = params.q?.trim();
  if (q) {
    const p = containsPattern(q);
    const match = or(
      ilike(invoices.number, p),
      ilike(customers.name, p),
      ilike(subscriptions.number, p),
    );
    if (match) conds.push(match);
  }
  if (params.status) conds.push(eq(invoices.status, params.status));
  if (params.customerId) conds.push(eq(invoices.customerId, params.customerId));
  if (params.subscriptionId)
    conds.push(eq(invoices.subscriptionId, params.subscriptionId));
  switch (params.view) {
    case "draft":
      conds.push(eq(invoices.status, "draft"));
      break;
    case "unpaid":
      conds.push(eq(invoices.status, "confirmed"));
      break;
    case "overdue":
      conds.push(
        eq(invoices.status, "confirmed"),
        lt(invoices.dueDate, params.today),
        sql`${invoices.amountPaid} < ${invoices.total}`,
      );
      break;
    case "paid":
      conds.push(eq(invoices.status, "paid"));
      break;
    default:
      break;
  }
  const where = conds.length ? and(...conds) : undefined;

  const sortCols = {
    number: invoices.number,
    customerName: customers.name,
    issuedOn: invoices.issuedOn,
    dueDate: invoices.dueDate,
    total: invoices.total,
    amountPaid: invoices.amountPaid,
    balance: sql`${invoices.total} - ${invoices.amountPaid}`,
  } as const;
  const sortCol =
    sortCols[(params.sort as keyof typeof sortCols) ?? "issuedOn"] ??
    invoices.issuedOn;

  const base = () =>
    db
      .select({
        inv: invoices,
        customerName: customers.name,
        subscriptionNumber: subscriptions.number,
      })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
      .where(where);

  const rows = await base()
    .orderBy(
      params.dir === "asc" ? asc(sortCol) : desc(sortCol),
      asc(invoices.id),
    )
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .where(where);

  return {
    rows: rows.map(({ inv, customerName, subscriptionNumber }) => {
      const { status } = inv;
      return {
        id: inv.id,
        number: inv.number,
        customerName,
        subscriptionNumber,
        issuedOn: inv.issuedOn,
        dueDate: inv.dueDate,
        total: inv.total,
        amountPaid: inv.amountPaid,
        balance: inv.total - inv.amountPaid,
        status,
        displayStatus: displayStatusOf(inv, params.today),
      };
    }),
    total,
    page,
    pageSize,
  };
}

export async function getInvoice(
  db: Db,
  id: string,
  opts: { today: string; deps: Pick<InvoiceDeps, "listActivity"> },
) {
  const [row] = await db
    .select({
      inv: invoices,
      subscriptionNumber: subscriptions.number,
    })
    .from(invoices)
    .innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
    .where(eq(invoices.id, id));
  if (!row) return null;
  const { inv } = row;
  const { status } = inv;
  const [lines, pays, activity] = await Promise.all([
    db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(invoiceLines.id)),
    db
      .select()
      .from(payments)
      .where(eq(payments.invoiceId, id))
      .orderBy(asc(payments.paidOn), asc(payments.createdAt)),
    opts.deps.listActivity(db, "invoice", id),
  ]);
  return {
    id: inv.id,
    number: inv.number,
    subscriptionId: inv.subscriptionId,
    subscriptionNumber: row.subscriptionNumber,
    customerId: inv.customerId,
    snapshot: inv.customerSnapshot,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    status,
    displayStatus: displayStatusOf(inv, opts.today),
    issuedOn: inv.issuedOn,
    dueDate: inv.dueDate,
    subtotal: inv.subtotal,
    discountTotal: inv.discountTotal,
    taxTotal: inv.taxTotal,
    total: inv.total,
    amountPaid: inv.amountPaid,
    balance: inv.total - inv.amountPaid,
    sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
    lines: lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      description: l.description,
      variantLabel: l.variantLabel,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRateBps: l.taxRateBps,
      discountAmount: l.discountAmount,
      taxAmount: l.taxAmount,
      lineTotal: l.lineTotal,
    })),
    payments: pays.map((p) => ({
      id: p.id,
      method: p.method,
      amount: p.amount,
      paidOn: p.paidOn,
      note: p.note,
    })),
    activity,
    availableActions: availableActions(inv),
  };
}
