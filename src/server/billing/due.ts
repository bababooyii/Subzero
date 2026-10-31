import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { subscriptions } from "@/db/schema";
import type { DB, Tx } from "./types";

/** Ids of active subscriptions whose next invoice date is on or before `on`, ordered by number. */
export async function findDueSubscriptions(
  db: DB | Tx,
  on: string,
  subscriptionIds?: string[],
): Promise<string[]> {
  if (subscriptionIds && subscriptionIds.length === 0) return [];
  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "active"),
        isNotNull(subscriptions.nextInvoiceDate),
        lte(subscriptions.nextInvoiceDate, on),
        subscriptionIds ? inArray(subscriptions.id, subscriptionIds) : undefined,
      ),
    )
    .orderBy(asc(subscriptions.number));
  return rows.map((r) => r.id);
}
