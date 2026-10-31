import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema";
import { PAYMENT_METHODS, type PaymentMethod } from "@/components/billing/draft";

export type MethodTotal = { method: PaymentMethod; count: number; amount: number };

/** Received so far, per method (the stat tiles and the header subtitle). Amounts in paise. */
export async function paymentMethodTotals(): Promise<{ total: number; count: number; methods: MethodTotal[] }> {
  const rows = await db
    .select({
      method: payments.method,
      count: sql<number>`count(*)::int`,
      amount: sql<number>`coalesce(sum(${payments.amount}), 0)::float8`,
    })
    .from(payments)
    .groupBy(payments.method);
  const methods = PAYMENT_METHODS.map((method) => {
    const r = rows.find((x) => x.method === method);
    return { method, count: r?.count ?? 0, amount: r?.amount ?? 0 };
  });
  return {
    total: methods.reduce((n, m) => n + m.amount, 0),
    count: methods.reduce((n, m) => n + m.count, 0),
    methods,
  };
}
