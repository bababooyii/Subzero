import { and, eq, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { invoices } from "@/db/schema";
import type { InvoiceView as BackendView } from "@/features/invoices/schemas";

/** Saved views on the Invoices page. Same labels as ever; "confirmed" and "cancelled" are status filters in the backend. */
export const INVOICE_VIEWS = ["all", "draft", "confirmed", "paid", "overdue", "cancelled"] as const;
export type InvoicePageView = (typeof INVOICE_VIEWS)[number];

/** The `listInvoices` filter for a saved view. */
export function viewFilter(view: InvoicePageView): { view?: BackendView; status?: "confirmed" | "cancelled" } {
  switch (view) {
    case "confirmed":
      return { status: "confirmed" };
    case "cancelled":
      return { status: "cancelled" };
    case "all":
      return {};
    default:
      return { view };
  }
}

/** Unpaid balance across everything in the view (only confirmed invoices carry a balance). Paise. */
export async function outstandingFor(view: InvoicePageView, today: string): Promise<number> {
  if (view === "draft" || view === "paid" || view === "cancelled") return 0;
  const conds: SQL[] = [eq(invoices.status, "confirmed")];
  if (view === "overdue") conds.push(lt(invoices.dueDate, today), sql`${invoices.amountPaid} < ${invoices.total}`);
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${invoices.total} - ${invoices.amountPaid}), 0)::float8` })
    .from(invoices)
    .where(and(...conds));
  return row?.n ?? 0;
}
