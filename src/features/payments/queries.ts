import { and, asc, desc, eq, gt, gte, ilike, lt, lte, or, sql, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { customers, invoices, payments } from "@/db/schema";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";

type Executor = DB | Tx;

export type PaymentListRow = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  method: "upi" | "card" | "bank_transfer" | "cash";
  amount: number;
  paidOn: string;
  note: string | null;
};

const SORTS = {
  paidOn: payments.paidOn,
  amount: payments.amount,
  invoiceNumber: invoices.number,
  customerName: customers.name,
} as const;

export async function listPayments(
  db: Executor,
  params: ListParams & { method?: PaymentListRow["method"]; from?: string; to?: string; customerId?: string },
): Promise<Paged<PaymentListRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const conds: SQL[] = [];
  if (params.method) conds.push(eq(payments.method, params.method));
  if (params.from) conds.push(gte(payments.paidOn, params.from));
  if (params.to) conds.push(lte(payments.paidOn, params.to));
  if (params.customerId) conds.push(eq(invoices.customerId, params.customerId));
  if (params.q?.trim()) {
    const like = `%${params.q.trim()}%`;
    conds.push(or(ilike(invoices.number, like), ilike(customers.name, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const sortCol = SORTS[params.sort as keyof typeof SORTS] ?? payments.paidOn;
  const order = (params.sort ? params.dir === "desc" : params.dir !== "asc") ? desc(sortCol) : asc(sortCol);

  const base = db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      invoiceNumber: invoices.number,
      customerId: invoices.customerId,
      customerName: customers.name,
      method: payments.method,
      amount: payments.amount,
      paidOn: payments.paidOn,
      note: payments.note,
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(where);

  const rows = await base.orderBy(order, desc(payments.createdAt), asc(payments.id)).limit(limit).offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(where);
  return { rows, total, page, pageSize };
}

export async function invoiceBalance(
  db: Executor,
  invoiceId: string,
): Promise<{ total: number; amountPaid: number; balance: number } | null> {
  const [row] = await db
    .select({ total: invoices.total, amountPaid: invoices.amountPaid })
    .from(invoices)
    .where(eq(invoices.id, invoiceId));
  return row ? { ...row, balance: row.total - row.amountPaid } : null;
}

export type OutstandingRow = {
  invoiceId: string;
  number: string;
  customerId: string;
  customerName: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
};

/** Confirmed invoices with a balance. `daysOverdue` is 0 when not yet due. */
export async function listOutstanding(
  db: Executor,
  params: ListParams & { overdueOnly?: boolean; today: string },
): Promise<Paged<OutstandingRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const conds: SQL[] = [eq(invoices.status, "confirmed"), gt(sql`${invoices.total} - ${invoices.amountPaid}`, sql`0`)];
  if (params.overdueOnly) conds.push(lt(invoices.dueDate, params.today));
  if (params.q?.trim()) {
    const like = `%${params.q.trim()}%`;
    conds.push(or(ilike(invoices.number, like), ilike(customers.name, like))!);
  }
  const where = and(...conds);

  const daysOverdue = sql<number>`greatest(0, (${params.today}::date - ${invoices.dueDate}))::int`;
  const balance = sql<number>`(${invoices.total} - ${invoices.amountPaid})::int`;
  const SORT: Record<string, SQL> = {
    dueDate: sql`${invoices.dueDate}`,
    balance,
    number: sql`${invoices.number}`,
    customerName: sql`${customers.name}`,
  };
  const sortCol = SORT[params.sort ?? ""] ?? SORT.dueDate;
  const order = params.dir === "desc" ? desc(sortCol) : asc(sortCol);

  const rows = await db
    .select({
      invoiceId: invoices.id,
      number: invoices.number,
      customerId: invoices.customerId,
      customerName: customers.name,
      dueDate: invoices.dueDate,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      balance,
      daysOverdue,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(where)
    .orderBy(order, asc(invoices.id))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(where);
  return { rows, total, page, pageSize };
}
