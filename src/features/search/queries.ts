import { desc, eq, ilike, or } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { customers, invoices, products, subscriptions } from "@/db/schema";
import { containsPattern } from "@/features/catalog/queries";
import { displayStatusOf, type InvoiceRow } from "@/features/invoices/queries";

type SubStatus = Pick<typeof subscriptions.$inferSelect, "status">;
type InvStatus = Pick<typeof invoices.$inferSelect, "status">;

type Db = DB | Tx;

export type SearchResults = {
  customers: { id: string; name: string; email: string }[];
  subscriptions: ({ id: string; number: string; customerName: string } & SubStatus)[];
  invoices: ({ id: string; number: string; customerName: string; displayStatus: string } & InvStatus)[];
  products: { id: string; name: string }[];
};

export async function globalSearch(
  db: Db,
  q: string,
  opts: { limit?: number; today?: string } = {},
): Promise<SearchResults> {
  const term = q.trim();
  const empty: SearchResults = { customers: [], subscriptions: [], invoices: [], products: [] };
  if (!term) return empty;
  const limit = Math.min(20, Math.max(1, Math.floor(opts.limit ?? 5)));
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const p = containsPattern(term);

  const [cust, subs, invs, prods] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name, email: customers.email })
      .from(customers)
      .where(or(ilike(customers.name, p), ilike(customers.email, p), ilike(customers.company, p)))
      .orderBy(customers.name)
      .limit(limit),
    db
      .select({
        id: subscriptions.id,
        number: subscriptions.number,
        customerName: customers.name,
        subStatus: subscriptions.status,
      })
      .from(subscriptions)
      .innerJoin(customers, eq(customers.id, subscriptions.customerId))
      .where(or(ilike(subscriptions.number, p), ilike(customers.name, p)))
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        customerName: customers.name,
        invStatus: invoices.status,
        dueDate: invoices.dueDate,
        total: invoices.total,
        amountPaid: invoices.amountPaid,
      })
      .from(invoices)
      .innerJoin(customers, eq(customers.id, invoices.customerId))
      .where(or(ilike(invoices.number, p), ilike(customers.name, p)))
      .orderBy(desc(invoices.createdAt))
      .limit(limit),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(ilike(products.name, p))
      .orderBy(products.name)
      .limit(limit),
  ]);

  return {
    customers: cust,
    subscriptions: subs.map(({ subStatus: status, ...rest }) => ({ ...rest, status })),
    invoices: invs.map(({ invStatus: status, dueDate, total, amountPaid, ...rest }) => ({
      ...rest,
      status,
      displayStatus: displayStatusOf({ status, dueDate, total, amountPaid } as Pick<InvoiceRow, "status"> & {
        dueDate: string;
        total: number;
        amountPaid: number;
      }, today),
    })),
    products: prods,
  };
}
