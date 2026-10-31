import { TODAY_ISO } from "./clock";
import { addDays, addMonths, daysBetween, getDb } from "./data";
import { type PricedTotals, priceLines } from "./pricing";
import type {
  ActivityEvent,
  Customer,
  Discount,
  Interval,
  Invoice,
  InvoiceDisplayStatus,
  Payment,
  Plan,
  Product,
  QuotationTemplate,
  Subscription,
  SubscriptionStatus,
  Tax,
  User,
} from "./types";

/* ---------- lookups ---------- */

export function getCustomer(id: string): Customer | undefined {
  return getDb().customers.find((c) => c.id === id);
}
export function customerName(id: string): string {
  return getCustomer(id)?.name ?? "Unknown customer";
}
export function getPlan(id: string): Plan | undefined {
  return getDb().plans.find((p) => p.id === id);
}
export function getProduct(id: string): Product | undefined {
  return getDb().products.find((p) => p.id === id);
}
export function getSubscription(id: string): Subscription | undefined {
  return getDb().subscriptions.find((s) => s.id === id);
}
export function getInvoice(id: string): Invoice | undefined {
  return getDb().invoices.find((i) => i.id === id);
}

/* ---------- invoices ---------- */

export function invoiceBalance(inv: Invoice): number {
  if (inv.status === "cancelled" || inv.status === "draft") return 0;
  return Math.max(0, inv.total - inv.amountPaid);
}

export function isOverdue(inv: Invoice): boolean {
  return inv.status === "confirmed" && invoiceBalance(inv) > 0 && inv.dueDate < TODAY_ISO;
}

export function daysOverdue(inv: Invoice): number {
  return isOverdue(inv) ? daysBetween(inv.dueDate, TODAY_ISO) : 0;
}

export function invoiceDisplayStatus(inv: Invoice): InvoiceDisplayStatus {
  if (inv.status === "confirmed") {
    if (isOverdue(inv)) return "overdue";
    if (inv.amountPaid > 0) return "partial";
  }
  return inv.status;
}

export type InvoiceFilter = {
  status?: InvoiceDisplayStatus | "open" | "all";
  customerId?: string;
  subscriptionId?: string;
  q?: string;
};

export function listInvoices(filter: InvoiceFilter = {}): Invoice[] {
  const q = filter.q?.trim().toLowerCase();
  return getDb()
    .invoices.filter((inv) => {
      if (filter.customerId && inv.customerId !== filter.customerId) return false;
      if (filter.subscriptionId && inv.subscriptionId !== filter.subscriptionId) return false;
      if (filter.status && filter.status !== "all") {
        if (filter.status === "open") {
          if (invoiceBalance(inv) <= 0) return false;
        } else if (invoiceDisplayStatus(inv) !== filter.status) return false;
      }
      if (q && !`${inv.number} ${customerName(inv.customerId)}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : a.number < b.number ? 1 : -1));
}

export function listPayments(filter: { customerId?: string; invoiceId?: string } = {}): Payment[] {
  return getDb().payments.filter(
    (p) => (!filter.customerId || p.customerId === filter.customerId) && (!filter.invoiceId || p.invoiceId === filter.invoiceId),
  );
}

/* ---------- subscriptions ---------- */

export type SubscriptionView = "all" | "active" | "paused" | "due" | "closing" | "quotation" | "closed";
export type SubscriptionFilter = {
  view?: SubscriptionView;
  status?: SubscriptionStatus;
  customerId?: string;
  q?: string;
};

export function subscriptionTotals(sub: Subscription): PricedTotals {
  const { taxes, discounts } = getDb();
  return priceLines(sub.lines, taxes, discounts);
}

const MONTHS_PER: Record<Interval, number> = { daily: 1 / 30, weekly: 12 / 52, monthly: 1, yearly: 12 };

/** Monthly recurring revenue of a subscription, ex tax, paise. */
export function subscriptionMrr(sub: Subscription): number {
  const plan = getPlan(sub.planId);
  if (!plan) return 0;
  const t = subscriptionTotals(sub);
  return Math.round((t.subtotal - t.discountTotal) / MONTHS_PER[plan.interval]);
}

export function isDueToday(sub: Subscription): boolean {
  return sub.status === "active" && !!sub.nextBillingDate && sub.nextBillingDate <= TODAY_ISO;
}

export function listSubscriptions(filter: SubscriptionFilter = {}): Subscription[] {
  const q = filter.q?.trim().toLowerCase();
  const closingBy = addDays(TODAY_ISO, 30);
  return getDb()
    .subscriptions.filter((s) => {
      if (filter.customerId && s.customerId !== filter.customerId) return false;
      if (filter.status && s.status !== filter.status) return false;
      switch (filter.view) {
        case "active":
          if (s.status !== "active") return false;
          break;
        case "paused":
          if (s.status !== "paused") return false;
          break;
        case "due":
          if (!isDueToday(s)) return false;
          break;
        case "closing":
          if (!(s.status === "active" && s.expiryDate <= closingBy)) return false;
          break;
        case "quotation":
          if (s.status !== "quotation") return false;
          break;
        case "closed":
          if (s.status !== "closed") return false;
          break;
      }
      if (q && !`${s.number} ${customerName(s.customerId)}`.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (a.number < b.number ? 1 : -1));
}

export type DueForBilling = { subscription: Subscription; customer: Customer; plan: Plan; totals: PricedTotals; periodStart: string; periodEnd: string };

/** Active subscriptions whose next billing date has arrived. */
export function dueForBilling(): DueForBilling[] {
  return getDb()
    .subscriptions.filter(isDueToday)
    .map((subscription) => {
      const plan = getPlan(subscription.planId)!;
      const start = subscription.nextBillingDate!;
      const next =
        plan.interval === "daily" ? addDays(start, 1) : plan.interval === "weekly" ? addDays(start, 7) : plan.interval === "monthly" ? addMonths(start, 1) : addMonths(start, 12);
      return {
        subscription,
        customer: getCustomer(subscription.customerId)!,
        plan,
        totals: subscriptionTotals(subscription),
        periodStart: start,
        periodEnd: addDays(next, -1),
      };
    })
    .sort((a, b) => (a.subscription.number < b.subscription.number ? -1 : 1));
}

/* ---------- customers ---------- */

export type CustomerRow = Customer & { activeSubscriptions: number; outstanding: number; overdue: number };

export function listCustomers(q?: string): CustomerRow[] {
  const { customers, subscriptions, invoices } = getDb();
  const needle = q?.trim().toLowerCase();
  return customers
    .filter((c) => !needle || `${c.name} ${c.contactName} ${c.city}`.toLowerCase().includes(needle))
    .map((c) => {
      const mine = invoices.filter((i) => i.customerId === c.id);
      return {
        ...c,
        activeSubscriptions: subscriptions.filter((s) => s.customerId === c.id && s.status === "active").length,
        outstanding: mine.reduce((n, i) => n + invoiceBalance(i), 0),
        overdue: mine.filter(isOverdue).reduce((n, i) => n + invoiceBalance(i), 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function customerPortalData(customerId: string) {
  const customer = getCustomer(customerId);
  const subscriptions = listSubscriptions({ customerId }).filter((s) => s.status !== "draft");
  const invoices = listInvoices({ customerId }).filter((i) => i.status !== "draft");
  return {
    customer,
    subscriptions: subscriptions.map((s) => ({ subscription: s, plan: getPlan(s.planId)!, totals: subscriptionTotals(s) })),
    invoices,
    outstanding: invoices.reduce((n, i) => n + invoiceBalance(i), 0),
  };
}

/* ---------- dashboard ---------- */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthKey = (iso: string) => iso.slice(0, 7);
const THIS_MONTH = monthKey(TODAY_ISO);
const LAST_MONTH = monthKey(addMonths(`${THIS_MONTH}-01`, -1));

/** Subscriptions, invoices and payments, optionally limited to one plan. */
function scoped(planId?: string) {
  const db = getDb();
  if (!planId) return db;
  const subs = db.subscriptions.filter((s) => s.planId === planId);
  const ids = new Set(subs.map((s) => s.id));
  const invoices = db.invoices.filter((i) => ids.has(i.subscriptionId));
  const invIds = new Set(invoices.map((i) => i.id));
  return { ...db, subscriptions: subs, invoices, payments: db.payments.filter((p) => invIds.has(p.invoiceId)) };
}

export function dashboardKpis(planId?: string) {
  const { subscriptions, invoices, payments } = scoped(planId);
  const active = subscriptions.filter((s) => s.status === "active");
  const mrr = active.reduce((n, s) => n + subscriptionMrr(s), 0);
  const startedThisMonth = active.filter((s) => monthKey(s.startDate) === THIS_MONTH).length;
  const mrrLastMonth = subscriptions
    .filter((s) => (s.status === "active" || s.status === "paused") && s.startDate < `${THIS_MONTH}-01`)
    .reduce((n, s) => n + (s.status === "active" ? subscriptionMrr(s) : 0), 0);
  const collected = payments.filter((p) => monthKey(p.date) === THIS_MONTH).reduce((n, p) => n + p.amount, 0);
  const collectedPrev = payments
    .filter((p) => monthKey(p.date) === LAST_MONTH && p.date.slice(8) <= TODAY_ISO.slice(8))
    .reduce((n, p) => n + p.amount, 0);
  const open = invoices.filter((i) => invoiceBalance(i) > 0);
  const overdue = invoices.filter(isOverdue);
  return {
    activeSubscriptions: active.length,
    activeDelta: startedThisMonth,
    mrr,
    mrrDeltaPct: mrrLastMonth ? Math.round(((mrr - mrrLastMonth) / mrrLastMonth) * 1000) / 10 : 0,
    collected,
    collectedDeltaPct: collectedPrev ? Math.round(((collected - collectedPrev) / collectedPrev) * 1000) / 10 : 0,
    outstanding: open.reduce((n, i) => n + invoiceBalance(i), 0),
    openCount: open.length,
    overdueAmount: overdue.reduce((n, i) => n + invoiceBalance(i), 0),
    overdueCount: overdue.length,
  };
}

export type MonthRevenue = { key: string; month: string; invoiced: number; collected: number };

/** Last `months` months (default 6) including the current one. Invoiced excludes drafts and cancelled invoices. */
export function revenueByMonth(planId?: string, months = 6): MonthRevenue[] {
  const { invoices, payments } = scoped(planId);
  const out: MonthRevenue[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = monthKey(addMonths(`${THIS_MONTH}-01`, -i));
    out.push({
      key,
      month: MONTH_NAMES[Number(key.slice(5)) - 1],
      invoiced: invoices.filter((x) => (x.status === "confirmed" || x.status === "paid") && monthKey(x.issueDate) === key).reduce((n, x) => n + x.total, 0),
      collected: payments.filter((p) => monthKey(p.date) === key).reduce((n, p) => n + p.amount, 0),
    });
  }
  return out;
}

export type RevenuePeriod = { key: string; label: string; range: string; invoiced: number; collected: number };

/**
 * Revenue buckets for the dashboard chart. Up to 3 months are split into 15-day halves (1–15, 16–end),
 * so the chart never shows just three bars; longer ranges keep monthly bars. Includes the current month.
 */
export function revenueByPeriod(planId?: string, months = 6): RevenuePeriod[] {
  if (months > 3) {
    return revenueByMonth(planId, months).map((m) => ({ key: m.key, label: m.month, range: m.month, invoiced: m.invoiced, collected: m.collected }));
  }
  const { invoices, payments } = scoped(planId);
  const out: RevenuePeriod[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const first = addMonths(`${THIS_MONTH}-01`, -i);
    const key = monthKey(first);
    const name = MONTH_NAMES[Number(key.slice(5)) - 1];
    const lastDay = addDays(addMonths(first, 1), -1).slice(8);
    for (const [from, to] of [
      ["01", "15"],
      ["16", lastDay],
    ]) {
      const inHalf = (iso: string) => monthKey(iso) === key && iso.slice(8) >= from && iso.slice(8) <= to;
      out.push({
        key: `${key}-${from}`,
        label: `${name} ${Number(from)}`,
        range: `${name} ${Number(from)}–${Number(to)}`,
        invoiced: invoices.filter((x) => (x.status === "confirmed" || x.status === "paid") && inHalf(x.issueDate)).reduce((n, x) => n + x.total, 0),
        collected: payments.filter((p) => inHalf(p.date)).reduce((n, p) => n + p.amount, 0),
      });
    }
  }
  return out;
}

export type AgeingBucket = { key: "0-30" | "31-60" | "60+"; label: string; count: number; amount: number };

export function overdueAgeing(planId?: string): AgeingBucket[] {
  const buckets: AgeingBucket[] = [
    { key: "0-30", label: "0–30 days", count: 0, amount: 0 },
    { key: "31-60", label: "31–60 days", count: 0, amount: 0 },
    { key: "60+", label: "60+ days", count: 0, amount: 0 },
  ];
  for (const inv of scoped(planId).invoices.filter(isOverdue)) {
    const d = daysOverdue(inv);
    const b = d <= 30 ? buckets[0] : d <= 60 ? buckets[1] : buckets[2];
    b.count += 1;
    b.amount += invoiceBalance(inv);
  }
  return buckets;
}

export function overdueInvoices(limit = 8, planId?: string): Invoice[] {
  return scoped(planId)
    .invoices.filter(isOverdue)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    .slice(0, limit);
}

export function sidebarCounts() {
  return {
    dueToday: getDb().subscriptions.filter(isDueToday).length,
    overdue: getDb().invoices.filter(isOverdue).length,
  };
}

/* ---------- activity ---------- */

export function recentActivity(limit = 10): ActivityEvent[] {
  return getDb().events.slice(0, limit);
}

export function entityActivity(entity: ActivityEvent["entity"], entityId: string): ActivityEvent[] {
  return getDb().events.filter((e) => e.entity === entity && e.entityId === entityId);
}

/* ---------- command palette ---------- */

export type SearchIndex = {
  subscriptions: { id: string; number: string; customer: string }[];
  customers: { id: string; name: string; city: string }[];
};

export function searchIndex(): SearchIndex {
  const { subscriptions, customers } = getDb();
  return {
    subscriptions: subscriptions.map((s) => ({ id: s.id, number: s.number, customer: customerName(s.customerId) })),
    customers: customers.map((c) => ({ id: c.id, name: c.name, city: c.city })),
  };
}

/* ---------- catalog ---------- */

export function listProducts(): Product[] {
  return getDb().products;
}
export function listPlans(): Plan[] {
  return getDb().plans;
}
export function listTemplates(): QuotationTemplate[] {
  return getDb().templates;
}
export function listTaxes(): Tax[] {
  return getDb().taxes;
}
export function listDiscounts(): Discount[] {
  return getDb().discounts;
}
export function listUsers(): User[] {
  return getDb().users;
}
