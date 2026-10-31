import { asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { customers, invoices, subscriptions } from "@/db/schema";
import { containsPattern } from "@/features/catalog/queries";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";

type Db = DB | Tx;

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  userId: string | null;
  createdAt: string;
  activeSubscriptions: number;
  /** Sum of confirmed invoices (total - amount_paid), integer paise. */
  outstanding: number;
};

function aggregates(db: Db) {
  const subs = db
    .select({
      customerId: subscriptions.customerId,
      n: sql<number>`count(*)::int`.as("n"),
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"))
    .groupBy(subscriptions.customerId)
    .as("subs");
  const owed = db
    .select({
      customerId: invoices.customerId,
      amount: sql<number>`sum(${invoices.total} - ${invoices.amountPaid})::int`.as("amount"),
    })
    .from(invoices)
    .where(eq(invoices.status, "confirmed"))
    .groupBy(invoices.customerId)
    .as("owed");
  return { subs, owed };
}

export async function listCustomers(db: Db, params: ListParams = {}): Promise<Paged<CustomerRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const { subs, owed } = aggregates(db);
  const q = params.q?.trim();
  const where: SQL | undefined = q
    ? or(
        ilike(customers.name, containsPattern(q)),
        ilike(customers.email, containsPattern(q)),
        ilike(customers.company, containsPattern(q)),
      )
    : undefined;

  const activeSubscriptions = sql<number>`coalesce(${subs.n}, 0)`;
  const outstanding = sql<number>`coalesce(${owed.amount}, 0)`;
  const sortCols = {
    name: customers.name,
    email: customers.email,
    createdAt: customers.createdAt,
    outstanding,
    activeSubscriptions,
  } as const;
  const sortCol = sortCols[(params.sort as keyof typeof sortCols) ?? "name"] ?? customers.name;

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      company: customers.company,
      phone: customers.phone,
      userId: customers.userId,
      createdAt: customers.createdAt,
      activeSubscriptions,
      outstanding,
    })
    .from(customers)
    .leftJoin(subs, eq(subs.customerId, customers.id))
    .leftJoin(owed, eq(owed.customerId, customers.id))
    .where(where)
    .orderBy(params.dir === "desc" ? desc(sortCol) : asc(sortCol), asc(customers.id))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(customers)
    .where(where);
  return {
    rows: rows.map((r) => ({
      ...r,
      activeSubscriptions: Number(r.activeSubscriptions),
      outstanding: Number(r.outstanding),
      createdAt: r.createdAt.toISOString().slice(0, 10),
    })),
    total,
    page,
    pageSize,
  };
}

export async function getCustomer(db: Db, id: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) return null;
  const [subCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`(count(*) filter (where ${subscriptions.status} = 'active'))::int`,
    })
    .from(subscriptions)
    .where(eq(subscriptions.customerId, id));
  const [invCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      outstanding: sql<number>`coalesce(sum(${invoices.total} - ${invoices.amountPaid}) filter (where ${invoices.status} = 'confirmed'), 0)::int`,
    })
    .from(invoices)
    .where(eq(invoices.customerId, id));
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    email: c.email,
    company: c.company,
    phone: c.phone,
    address: c.address,
    gstin: c.gstin,
    createdAt: c.createdAt.toISOString().slice(0, 10),
    subscriptionCount: subCounts.total,
    activeSubscriptions: subCounts.active,
    invoiceCount: invCounts.total,
    outstanding: invCounts.outstanding,
  };
}
