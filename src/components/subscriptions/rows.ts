/** View models for the subscription and customer screens. Pure mappers from query results: no db access, safe to import anywhere. */
import type { StatusKey } from "@/components/ui/StatusDot";
import type { InvoiceRow as DbInvoiceRow } from "@/features/invoices/queries";
import type { getSubscription } from "@/features/subscriptions/queries";
import type { ActivityItem } from "@/server/activity-log";
import type { PriceResult } from "@/server/pricing";
import type { SubscriptionAction, SubscriptionStatus } from "@/server/state-machine/subscription";
import type { Interval } from "./labels";

export type TimelineRow = { id: string; at: string; text: string };

export type InvoiceRow = {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: StatusKey;
  total: number;
  balance: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route params are user input: a malformed id would make Postgres throw instead of returning no row. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function toInvoiceRow(i: DbInvoiceRow): InvoiceRow {
  return {
    id: i.id,
    number: i.number,
    issueDate: i.issuedOn,
    dueDate: i.dueDate,
    status: i.displayStatus === "partially_paid" ? "partial" : i.displayStatus,
    total: i.total,
    balance: i.balance,
  };
}

/* ---------- activity ---------- */

function verbOf(a: ActivityItem): string {
  if (a.action.startsWith("status:")) {
    switch (a.toStatus) {
      case "quotation":
        return "quotation sent";
      case "confirmed":
        return "confirmed";
      case "active":
        return a.fromStatus === "paused" ? "resumed" : "activated";
      case "paused":
        return "paused";
      case "closed":
        return "closed";
      case "draft":
        return "moved back to draft";
    }
  }
  switch (a.action) {
    case "created":
      return "created";
    case "updated":
      return "updated";
    case "renewed":
      return "renewed";
  }
  return a.action.replace(/[:_]/g, " ");
}

/** "SUB-0042 activated by Asha Menon". `label` names the record the entry belongs to. */
export function activityEvents(label: string, items: ActivityItem[], idPrefix: string): TimelineRow[] {
  return items.map((a, i) => ({
    id: `${idPrefix}-${i}`,
    at: a.at.toISOString(),
    text: `${label} ${verbOf(a)}${a.actorName ? ` by ${a.actorName}` : ""}`,
  }));
}

/* ---------- subscription record ---------- */

export type SubscriptionLineRow = {
  id: string;
  product: string;
  variant?: string;
  qty: number;
  unitPrice: number;
  tax: string;
  /** Line discount in paise (0 when none). */
  discount: number;
  /** qty × unit price minus the line discount, before tax. */
  amount: number;
};

export type SubscriptionDetail = {
  id: string;
  number: string;
  status: SubscriptionStatus;
  customer: { id: string; name: string };
  plan: { id: string; name: string; interval: Interval; minQty: number; pausable: boolean; closable: boolean };
  startDate: string;
  expiryDate: string | null;
  paymentTerms: string;
  nextBillingDate: string | null;
  lines: SubscriptionLineRow[];
  totals: { subtotal: number; discountTotal: number; taxTotal: number; total: number };
  invoices: InvoiceRow[];
  events: TimelineRow[];
  /** What the state machine allows right now; drives the buttons. */
  actions: { action: SubscriptionAction; label: string }[];
};

type Sub = NonNullable<Awaited<ReturnType<typeof getSubscription>>>;

const bpsLabel = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;

export function toSubscriptionDetail(
  sub: Sub,
  quote: PriceResult,
  invoices: DbInvoiceRow[],
  paymentTermName: string,
  taxes: { name: string; rateBps: number }[],
): SubscriptionDetail {
  const priced = new Map(quote.lines.map((l) => [l.key, l]));
  return {
    id: sub.id,
    number: sub.number,
    status: sub.status,
    customer: { id: sub.customer.id, name: sub.customer.name },
    plan: {
      id: sub.plan.id,
      name: sub.plan.name,
      interval: sub.plan.interval,
      minQty: sub.plan.minQty,
      pausable: sub.plan.pausable,
      closable: sub.plan.closable,
    },
    startDate: sub.startDate,
    expiryDate: sub.expiryDate,
    paymentTerms: paymentTermName,
    nextBillingDate: sub.nextInvoiceDate,
    lines: sub.lines.map((l) => {
      const p = priced.get(l.id);
      const discount = p?.discount ?? 0;
      const rate = p?.taxRateBps ?? 0;
      return {
        id: l.id,
        product: l.productName,
        variant: l.variantLabel ?? undefined,
        qty: l.quantity,
        unitPrice: l.unitPrice,
        tax: rate === 0 ? "Exempt" : (taxes.find((t) => t.rateBps === rate)?.name ?? bpsLabel(rate)),
        discount,
        amount: l.lineTotal - discount,
      };
    }),
    totals: {
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
    },
    invoices: invoices.map(toInvoiceRow),
    events: activityEvents(sub.number, sub.activity, "act").slice(0, 12),
    actions: sub.availableActions.map((a) => ({ action: a.action, label: a.label })),
  };
}

/* ---------- subscriptions list views ---------- */

export type SubscriptionViewKey = "all" | "active" | "quotations" | "paused" | "closing_this_month" | "due_today";

export const SUBSCRIPTION_VIEWS: { key: SubscriptionViewKey; label: string; description: string }[] = [
  { key: "all", label: "All", description: "Every subscription" },
  { key: "active", label: "Active", description: "Billing on schedule" },
  { key: "quotations", label: "Quotations", description: "Waiting for confirmation" },
  { key: "paused", label: "Paused", description: "Billing on hold" },
  { key: "closing_this_month", label: "Closing this month", description: "Expire this month" },
  { key: "due_today", label: "Due today", description: "Ready for the billing run" },
];

/** Older links used the short names; keep them working. */
const VIEW_ALIAS: Record<string, SubscriptionViewKey> = {
  quotation: "quotations",
  closing: "closing_this_month",
  due: "due_today",
};

export function parseSubscriptionView(value: string | undefined): SubscriptionViewKey {
  if (value && Object.hasOwn(VIEW_ALIAS, value)) return VIEW_ALIAS[value];
  return SUBSCRIPTION_VIEWS.some((v) => v.key === value) ? (value as SubscriptionViewKey) : "all";
}
