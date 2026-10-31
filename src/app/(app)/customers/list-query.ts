/**
 * Customers list with the saved views and the Overdue column.
 * `listCustomers` (features/customers) has neither, so this mirrors its shape with one extra aggregate.
 */
import { asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import { customers, invoices, subscriptions } from "@/db/schema";
import { containsPattern } from "@/features/catalog/queries";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";

export type CustomerView = "all" | "overdue" | "active" | "inactive";

export const CUSTOMER_VIEWS: { key: CustomerView; label: string; description: string }[] = [
  { key: "all", label: "All", description: "Everyone you bill" },
  { key: "overdue", label: "Overdue", description: "Have invoices past due" },
  { key: "active", label: "Active subscribers", description: "At least one active subscription" },
  { key: "inactive", label: "No active plan", description: "Nothing billing right now" },
];

export function parseCustomerView(value: string | undefined): CustomerView {
  return CUSTOMER_VIEWS.some((v) => v.key === value) ? (value as CustomerView) : "all";
}

export type CustomerListRow = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string;
  activeSubscriptions: number;
  /** Confirmed invoices, total - amount paid, paise. */
  outstanding: number;
  /** The part of `outstanding` that is past its due date, paise. */
  overdue: number;
};

function aggregates(db: DB, today: string) {
  const subs = db
    .select({ customerId: subscriptions.customerId, n: sql<number>`count(*)::int`.as("n") })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"))
    .groupBy(subscriptions.customerId)
    .as("subs");
  const owed = db
    .select({
      customerId: invoices.customerId,
      outstanding: sql<number>`sum(${invoices.total} - ${invoices.amountPaid})::int`.as("outstanding"),
      overdue: sql<number>`coalesce(sum(${invoices.total} - ${invoices.amountPaid}) filter (where ${invoices.dueDate} < ${today}::date), 0)::int`.as("overdue"),
    })
    .from(invoices)
    .where(eq(invoices.status, "confirmed"))
    .groupBy(invoices.customerId)
    .as("owed");
  return { subs, owed };
}

export async function listCustomerRows(
  db: DB,
  params: ListParams & { view: CustomerView; today: string },
): Promise<Paged<CustomerListRow> & { outstanding: number }> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const { subs, owed } = aggregates(db, params.today);
  const activeSubscriptions = sql<number>`coalesce(${subs.n}, 0)`;
  const outstanding = sql<number>`coalesce(${owed.outstanding}, 0)`;
  const overdue = sql<number>`coalesce(${owed.overdue}, 0)`;

  const q = params.q?.trim();
  const conds: (SQL | undefined)[] = [
    q
      ? or(
          ilike(customers.name, containsPattern(q)),
          ilike(customers.email, containsPattern(q)),
          ilike(customers.company, containsPattern(q)),
        )
      : undefined,
    params.view === "overdue" ? sql`${overdue} > 0` : undefined,
    params.view === "active" ? sql`${activeSubscriptions} > 0` : undefined,
    params.view === "inactive" ? sql`${activeSubscriptions} = 0` : undefined,
  ];
  const where = sql.join(
    conds.filter((c): c is SQL => !!c),
    sql` and `,
  );
  const hasWhere = conds.some(Boolean);

  const sortCols = {
    name: customers.name,
    email: customers.email,
    activeSubscriptions,
    outstanding,
    overdue,
  } as const;
  const sortCol = sortCols[(params.sort as keyof typeof sortCols) ?? "name"] ?? customers.name;

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      company: customers.company,
      phone: customers.phone,
      email: customers.email,
      activeSubscriptions,
      outstanding,
      overdue,
    })
    .from(customers)
    .leftJoin(subs, eq(subs.customerId, customers.id))
    .leftJoin(owed, eq(owed.customerId, customers.id))
    .where(hasWhere ? where : undefined)
    .orderBy(params.dir === "desc" ? desc(sortCol) : asc(sortCol), asc(customers.id))
    .limit(limit)
    .offset(offset);

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      outstanding: sql<string>`coalesce(sum(${outstanding}), 0)::bigint`,
    })
    .from(customers)
    .leftJoin(subs, eq(subs.customerId, customers.id))
    .leftJoin(owed, eq(owed.customerId, customers.id))
    .where(hasWhere ? where : undefined);

  return {
    rows: rows.map((r) => ({
      ...r,
      activeSubscriptions: Number(r.activeSubscriptions),
      outstanding: Number(r.outstanding),
      overdue: Number(r.overdue),
    })),
    total: totals.total,
    outstanding: Number(totals.outstanding),
    page,
    pageSize,
  };
}

/** Customers with something past due, for the Overdue chip. */
export async function overdueCustomerCount(db: DB, today: string): Promise<number> {
  const { owed } = aggregates(db, today);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(owed)
    .where(sql`${owed.overdue} > 0`);
  return row?.n ?? 0;
}
