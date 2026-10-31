import { getDb } from "./data";
import type { PricedTotals } from "./pricing";
import {
  customerPortalData,
  entityActivity,
  getCustomer,
  getPlan,
  getSubscription,
  invoiceBalance,
  invoiceDisplayStatus,
  listInvoices,
  subscriptionTotals,
} from "./selectors";
import type { Customer, Interval, InvoiceDisplayStatus, SubscriptionStatus } from "./types";

/** The mock signed-in customer for the portal (Sundaram Hardware Mart: active subs, a quotation, an overdue invoice). */
export const PORTAL_CUSTOMER_ID = "cus-10";

export type PortalLine = {
  id: string;
  description: string;
  variant?: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
};

export type PortalSub = {
  id: string;
  number: string;
  status: SubscriptionStatus;
  planName: string;
  interval: Interval;
  pausable: boolean;
  closable: boolean;
  startDate: string;
  expiryDate: string;
  nextBillingDate: string | null;
  paymentTerms: string;
  /** Per-period total including tax, paise. */
  amount: number;
  totals: PricedTotals;
  lines: PortalLine[];
};

export type PortalInvoice = {
  id: string;
  number: string;
  subscriptionId: string;
  subscriptionNumber: string;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  status: InvoiceDisplayStatus;
  total: number;
  balance: number;
};

function toPortalSub(id: string): PortalSub | undefined {
  const sub = getSubscription(id);
  if (!sub) return undefined;
  const plan = getPlan(sub.planId);
  const taxes = getDb().taxes;
  const totals = subscriptionTotals(sub);
  return {
    id: sub.id,
    number: sub.number,
    status: sub.status,
    planName: plan?.name ?? "Plan",
    interval: plan?.interval ?? "monthly",
    pausable: plan?.pausable ?? false,
    closable: plan?.closable ?? false,
    startDate: sub.startDate,
    expiryDate: sub.expiryDate,
    nextBillingDate: sub.nextBillingDate,
    paymentTerms: sub.paymentTerms,
    amount: totals.total,
    totals,
    lines: sub.lines.map((l) => ({
      id: l.id,
      description: l.description,
      variant: l.variant,
      qty: l.qty,
      unitPrice: l.unitPrice,
      taxRate: taxes.find((t) => t.id === l.taxId)?.rate ?? 0,
      amount: Math.round(l.qty * l.unitPrice),
    })),
  };
}

function toPortalInvoice(inv: ReturnType<typeof listInvoices>[number]): PortalInvoice {
  return {
    id: inv.id,
    number: inv.number,
    subscriptionId: inv.subscriptionId,
    subscriptionNumber: getSubscription(inv.subscriptionId)?.number ?? "",
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    status: invoiceDisplayStatus(inv),
    total: inv.total,
    balance: invoiceBalance(inv),
  };
}

/** The customer's subscriptions: quotations first, then live ones, then closed ones. */
export function portalSubscriptions(customerId = PORTAL_CUSTOMER_ID): PortalSub[] {
  const order: Record<SubscriptionStatus, number> = { quotation: 0, active: 1, paused: 2, confirmed: 3, draft: 4, closed: 5 };
  return customerPortalData(customerId)
    .subscriptions.map((s) => toPortalSub(s.subscription.id)!)
    .sort((a, b) => order[a.status] - order[b.status] || a.number.localeCompare(b.number));
}

export function portalInvoices(customerId = PORTAL_CUSTOMER_ID): PortalInvoice[] {
  return customerPortalData(customerId).invoices.map(toPortalInvoice);
}

/** One of the customer's own subscriptions, or undefined when it belongs to someone else. */
export function portalSubscription(id: string, customerId = PORTAL_CUSTOMER_ID) {
  const sub = getSubscription(id);
  if (!sub || sub.customerId !== customerId || sub.status === "draft") return undefined;
  return {
    subscription: toPortalSub(id)!,
    invoices: listInvoices({ customerId, subscriptionId: id })
      .filter((i) => i.status !== "draft")
      .map(toPortalInvoice),
    events: entityActivity("subscription", id)
      .slice(0, 8)
      .map((e) => ({ id: e.id, at: e.at, text: e.text })),
  };
}

export function portalCustomer(customerId = PORTAL_CUSTOMER_ID) {
  return getCustomer(customerId) as Customer;
}

/** Lower-cased staff and customer emails, used for the signup "already registered" check. */
export function registeredEmails(): string[] {
  const { users, customers } = getDb();
  return [...users.map((u) => u.email), ...customers.map((c) => c.email)].map((e) => e.toLowerCase());
}

/** Lower-cased customer emails: signing in with one of these lands in the portal. */
export function customerEmails(): string[] {
  return getDb().customers.map((c) => c.email.toLowerCase());
}
