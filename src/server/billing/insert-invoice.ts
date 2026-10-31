import { and, eq, sql } from "drizzle-orm";
import { invoiceLines, invoices } from "@/db/schema";
import type { BuiltInvoice } from "./build-invoice";
import type { Tx } from "./types";

/**
 * Inserts the invoice (draft) and its lines. Returns null when an invoice for
 * (subscription, period_start) already exists. The caller holds a row lock on
 * the subscription, so the existence check and insert can't race; the unique
 * constraint is the backstop. The number is only drawn once we know we insert.
 */
export async function insertInvoice(
  tx: Tx,
  built: BuiltInvoice,
): Promise<{ id: string; number: string } | null> {
  const { header } = built;

  const existing = await tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.subscriptionId, header.subscriptionId),
        eq(invoices.periodStart, header.periodStart),
      ),
    );
  if (existing.length > 0) return null;

  const seq = await tx.execute<{ n: string }>(
    sql`select nextval('invoice_number_seq')::text as n`,
  );
  const number = `INV-${seq[0].n.padStart(4, "0")}`;

  const inserted = await tx
    .insert(invoices)
    .values({ ...header, number, status: "draft" })
    .onConflictDoNothing({ target: [invoices.subscriptionId, invoices.periodStart] })
    .returning({ id: invoices.id, number: invoices.number });
  if (inserted.length === 0) return null;

  const row = inserted[0];
  if (built.lines.length > 0) {
    await tx.insert(invoiceLines).values(built.lines.map((l) => ({ ...l, invoiceId: row.id })));
  }
  return row;
}
