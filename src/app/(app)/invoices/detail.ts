import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { paymentTerms, plans, subscriptions } from "@/db/schema";
import type { InvoiceDetail } from "@/components/billing/invoice-types";
import { toLineView } from "@/components/billing/invoice-types";
import type { PaymentMethod } from "@/components/billing/draft";
import { getInvoice } from "@/features/invoices/queries";
import { invoiceDeps } from "@/features/invoices/deps";
import { formatMoney } from "@/lib/format";
import { todayIST } from "@/lib/dates";
import type { ActivityItem } from "@/server/activity-log";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID_RE.test(v);

/** Plan and payment terms of a subscription, for the invoice header. */
export async function subscriptionInfo(subscriptionId: string) {
  const [row] = await db
    .select({ number: subscriptions.number, planName: plans.name, terms: paymentTerms.name })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .leftJoin(paymentTerms, eq(paymentTerms.id, subscriptions.paymentTermId))
    .where(eq(subscriptions.id, subscriptionId));
  return row ? { id: subscriptionId, number: row.number, planName: row.planName, paymentTerms: row.terms ?? "Immediate" } : null;
}

function eventText(a: ActivityItem, number: string): string {
  const by = a.actorName ? ` by ${a.actorName}` : "";
  const meta = (a.meta ?? {}) as { amount?: number; to?: string };
  switch (a.action) {
    case "status:confirmed":
      return `Invoice ${number} confirmed${by}`;
    case "status:cancelled":
      return `Invoice ${number} cancelled${by}`;
    case "status:paid":
      return `Invoice ${number} paid in full`;
    case "payment_recorded":
      return `Payment of ${formatMoney(meta.amount ?? 0)} recorded${by}`;
    case "payment_deleted":
      return `Payment of ${formatMoney(meta.amount ?? 0)} removed${by}`;
    case "sent":
      return `Invoice ${number} sent${meta.to ? ` to ${meta.to}` : ""}`;
    default:
      return a.toStatus ? `Invoice ${number} moved to ${a.toStatus}${by}` : `${a.action.replaceAll("_", " ")}${by}`;
  }
}

/** The invoice record: `getInvoice` plus the plan and terms, shaped for the UI. Null for an unknown id. */
export async function loadInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  if (!isUuid(id)) return null;
  const inv = await getInvoice(db, id, { today: todayIST(), deps: invoiceDeps });
  if (!inv) return null;
  const subscription = await subscriptionInfo(inv.subscriptionId);
  const snap = (inv.snapshot ?? {}) as Record<string, string | null | undefined>;
  const activity = inv.activity as ActivityItem[];
  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    displayStatus: inv.displayStatus,
    customer: {
      id: inv.customerId,
      name: snap.name ?? "Unknown customer",
      contactName: snap.company ?? "",
      email: snap.email ?? "",
      city: snap.address ?? "",
      gstin: snap.gstin ?? "",
    },
    subscription,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    issueDate: inv.issuedOn,
    dueDate: inv.dueDate,
    lines: inv.lines.map(toLineView),
    subtotal: inv.subtotal,
    discountTotal: inv.discountTotal,
    taxTotal: inv.taxTotal,
    total: inv.total,
    amountPaid: inv.amountPaid,
    sent: inv.sentAt !== null,
    canConfirm: inv.availableActions.includes("confirm"),
    canCancel: inv.availableActions.includes("cancel"),
    payments: inv.payments
      .map((p) => ({ id: p.id, date: p.paidOn, method: p.method as PaymentMethod, amount: p.amount, note: p.note ?? "" }))
      .reverse(),
    events: activity.map((a, i) => ({ id: `${i}`, at: new Date(a.at).toISOString(), text: eventText(a, inv.number) })),
  };
}
