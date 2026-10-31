/** Selectors for the Subscriptions and Customers screens. Everything returned is plain, serialisable data. */
import { TODAY_ISO } from "./clock";
import { addDays, getDb } from "./data";
import { discountAmount } from "./pricing";
import {
  customerName,
  entityActivity,
  getCustomer,
  getPlan,
  getProduct,
  getSubscription,
  invoiceBalance,
  invoiceDisplayStatus,
  isDueToday,
  isOverdue,
  listCustomers,
  listInvoices,
  listPayments,
  listSubscriptions,
  subscriptionMrr,
  subscriptionTotals,
  type SubscriptionView,
} from "./selectors";
import type {
  Interval,
  InvoiceDisplayStatus,
  PaymentMethod,
  SubscriptionStatus,
} from "./types";

/* ---------- shared row shapes ---------- */

export type TimelineRow = { id: string; at: string; text: string };

export type InvoiceRow = {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceDisplayStatus;
  total: number;
  balance: number;
};

function toInvoiceRows(customerId?: string, subscriptionId?: string): InvoiceRow[] {
  return listInvoices({ customerId, subscriptionId }).map((i) => ({
    id: i.id,
    number: i.number,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    status: invoiceDisplayStatus(i),
    total: i.total,
    balance: invoiceBalance(i),
  }));
}

/* ---------- subscriptions list ---------- */

export type SubscriptionRow = {
  id: string;
  number: string;
  customerId: string;
  customer: string;
  plan: string;
  status: SubscriptionStatus;
  nextBillingDate: string | null;
  mrr: number;
  startDate: string;
};

export const SUBSCRIPTION_VIEWS: { key: SubscriptionView; label: string; description: string }[] = [
  { key: "all", label: "All", description: "Every subscription" },
  { key: "active", label: "Active", description: "Billing on schedule" },
  { key: "quotation", label: "Quotations", description: "Waiting for confirmation" },
  { key: "paused", label: "Paused", description: "Billing on hold" },
  { key: "closing", label: "Closing this month", description: "Expire within 30 days" },
  { key: "due", label: "Due today", description: "Ready for the billing run" },
];

export function parseSubscriptionView(value: string | undefined): SubscriptionView {
  return SUBSCRIPTION_VIEWS.some((v) => v.key === value) ? (value as SubscriptionView) : "all";
}

export function subscriptionRows(view: SubscriptionView = "all", q?: string): SubscriptionRow[] {
  return listSubscriptions({ view, q }).map(toSubscriptionRow);
}

function toSubscriptionRow(s: ReturnType<typeof listSubscriptions>[number]): SubscriptionRow {
  return {
    id: s.id,
    number: s.number,
    customerId: s.customerId,
    customer: customerName(s.customerId),
    plan: getPlan(s.planId)?.name ?? "Unknown plan",
    status: s.status,
    nextBillingDate: s.nextBillingDate,
    mrr: subscriptionMrr(s),
    startDate: s.startDate,
  };
}

export function subscriptionViewCounts(): Record<SubscriptionView, number> {
  const subs = getDb().subscriptions;
  const closingBy = addDays(TODAY_ISO, 30);
  return {
    all: subs.length,
    active: subs.filter((s) => s.status === "active").length,
    quotation: subs.filter((s) => s.status === "quotation").length,
    paused: subs.filter((s) => s.status === "paused").length,
    closing: subs.filter((s) => s.status === "active" && s.expiryDate <= closingBy).length,
    due: subs.filter(isDueToday).length,
    closed: subs.filter((s) => s.status === "closed").length,
  };
}

/** Sum of MRR across a list of rows, for the intro subtitle. */
export function totalMrr(rows: SubscriptionRow[]): number {
  return rows.reduce((n, r) => n + r.mrr, 0);
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
  customer: { id: string; name: string; contactName: string };
  plan: { id: string; name: string; interval: Interval; minQty: number; pausable: boolean; closable: boolean };
  startDate: string;
  expiryDate: string;
  paymentTerms: string;
  nextBillingDate: string | null;
  lines: SubscriptionLineRow[];
  totals: { subtotal: number; discountTotal: number; taxTotal: number; total: number };
  invoices: InvoiceRow[];
  events: TimelineRow[];
};

export function subscriptionDetail(id: string): SubscriptionDetail | null {
  const sub = getSubscription(id);
  if (!sub) return null;
  const customer = getCustomer(sub.customerId);
  const plan = getPlan(sub.planId);
  if (!customer || !plan) return null;
  const { taxes, discounts, events } = getDb();

  const invoices = toInvoiceRows(undefined, sub.id);
  const invoiceIds = new Set(invoices.map((i) => i.id));
  const timeline = [
    ...entityActivity("subscription", sub.id),
    ...events.filter((e) => (e.entity === "invoice" || e.entity === "payment") && invoiceIds.has(e.entityId)),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 12)
    .map((e) => ({ id: e.id, at: e.at, text: e.text }));

  return {
    id: sub.id,
    number: sub.number,
    status: sub.status,
    customer: { id: customer.id, name: customer.name, contactName: customer.contactName },
    plan: { id: plan.id, name: plan.name, interval: plan.interval, minQty: plan.minQty, pausable: plan.pausable, closable: plan.closable },
    startDate: sub.startDate,
    expiryDate: sub.expiryDate,
    paymentTerms: sub.paymentTerms,
    nextBillingDate: sub.nextBillingDate,
    lines: sub.lines.map((l) => {
      const gross = Math.round(l.qty * l.unitPrice);
      const d = l.discountId ? discounts.find((x) => x.id === l.discountId) : undefined;
      const off = d ? discountAmount(gross, d) : 0;
      return {
        id: l.id,
        product: getProduct(l.productId)?.name ?? l.description,
        variant: l.variant,
        qty: l.qty,
        unitPrice: l.unitPrice,
        tax: taxes.find((t) => t.id === l.taxId)?.name ?? "Exempt",
        discount: off,
        amount: gross - off,
      };
    }),
    totals: subscriptionTotals(sub),
    invoices,
    events: timeline,
  };
}

/* ---------- new subscription form ---------- */

/** Unit prices scale with the plan interval, the same way the seeded subscriptions are priced. */
const INTERVAL_FACTOR: Record<Interval, number> = { daily: 0.04, weekly: 0.2, monthly: 1, yearly: 10 };

export type NewSubscriptionData = {
  customers: { id: string; name: string }[];
  plans: { id: string; name: string; price: number; interval: Interval; minQty: number; factor: number }[];
  products: { id: string; name: string; salesPrice: number; taxId?: string; variants: { label: string; extraPrice: number }[] }[];
  templates: { id: string; name: string; validityDays: number; planId: string; lines: { productId: string; qty: number }[] }[];
  taxes: { id: string; name: string; rate: number }[];
  discounts: {
    id: string;
    name: string;
    type: "fixed" | "percent";
    value: number;
    minPurchase: number;
    minQty: number;
    scope: "products" | "subscription";
    targetIds: string[];
  }[];
  today: string;
};

export function newSubscriptionData(): NewSubscriptionData {
  const db = getDb();
  return {
    customers: db.customers.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    plans: db.plans
      .filter((p) => p.startDate <= TODAY_ISO && (!p.endDate || p.endDate >= TODAY_ISO))
      .map((p) => ({ id: p.id, name: p.name, price: p.price, interval: p.interval, minQty: p.minQty, factor: INTERVAL_FACTOR[p.interval] })),
    products: db.products.map((p) => ({
      id: p.id,
      name: p.name,
      salesPrice: p.salesPrice,
      taxId: p.taxId,
      variants: p.variants.map((v) => ({ label: `${v.attribute}: ${v.value}`, extraPrice: v.extraPrice })),
    })),
    templates: db.templates.map((t) => ({ id: t.id, name: t.name, validityDays: t.validityDays, planId: t.planId, lines: t.lines })),
    taxes: db.taxes,
    // Only discounts that are live today and not used up.
    discounts: db.discounts
      .filter((d) => d.start <= TODAY_ISO && d.end >= TODAY_ISO && (d.usageLimit === null || d.timesUsed < d.usageLimit))
      .map((d) => ({ id: d.id, name: d.name, type: d.type, value: d.value, minPurchase: d.minPurchase, minQty: d.minQty, scope: d.scope, targetIds: d.targetIds })),
    today: TODAY_ISO,
  };
}

/* ---------- customers ---------- */

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
  contactName: string;
  email: string;
  city: string;
  activeSubscriptions: number;
  outstanding: number;
  overdue: number;
};

function matchesCustomerView(c: CustomerListRow, view: CustomerView): boolean {
  switch (view) {
    case "overdue":
      return c.overdue > 0;
    case "active":
      return c.activeSubscriptions > 0;
    case "inactive":
      return c.activeSubscriptions === 0;
    default:
      return true;
  }
}

export function customerRows(view: CustomerView = "all"): CustomerListRow[] {
  return allCustomerRows().filter((c) => matchesCustomerView(c, view));
}

function allCustomerRows(): CustomerListRow[] {
  return listCustomers().map((c) => ({
    id: c.id,
    name: c.name,
    contactName: c.contactName,
    email: c.email,
    city: c.city,
    activeSubscriptions: c.activeSubscriptions,
    outstanding: c.outstanding,
    overdue: c.overdue,
  }));
}

export function customerViewCounts(): Record<CustomerView, number> {
  const rows = allCustomerRows();
  return {
    all: rows.length,
    overdue: rows.filter((c) => matchesCustomerView(c, "overdue")).length,
    active: rows.filter((c) => matchesCustomerView(c, "active")).length,
    inactive: rows.filter((c) => matchesCustomerView(c, "inactive")).length,
  };
}

export type PaymentRow = {
  id: string;
  date: string;
  invoiceId: string;
  invoiceNumber: string;
  method: PaymentMethod;
  amount: number;
  note: string;
};

export type CustomerDetail = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  gstin: string;
  createdAt: string;
  activeSubscriptions: number;
  outstanding: number;
  overdue: number;
  subscriptions: SubscriptionRow[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  events: TimelineRow[];
};

export function customerDetail(id: string): CustomerDetail | null {
  const customer = getCustomer(id);
  if (!customer) return null;
  const db = getDb();
  const subs = listSubscriptions({ customerId: id });
  const invoices = listInvoices({ customerId: id });
  const subIds = new Set(subs.map((s) => s.id));
  const invIds = new Set(invoices.map((i) => i.id));

  const events = db.events
    .filter(
      (e) =>
        (e.entity === "customer" && e.entityId === id) ||
        (e.entity === "subscription" && subIds.has(e.entityId)) ||
        ((e.entity === "invoice" || e.entity === "payment") && invIds.has(e.entityId)),
    )
    .slice(0, 8)
    .map((e) => ({ id: e.id, at: e.at, text: e.text }));

  return {
    id: customer.id,
    name: customer.name,
    contactName: customer.contactName,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    gstin: customer.gstin,
    createdAt: customer.createdAt,
    activeSubscriptions: subs.filter((s) => s.status === "active").length,
    outstanding: invoices.reduce((n, i) => n + invoiceBalance(i), 0),
    overdue: invoices.filter(isOverdue).reduce((n, i) => n + invoiceBalance(i), 0),
    subscriptions: subs.map(toSubscriptionRow),
    invoices: toInvoiceRows(id),
    payments: listPayments({ customerId: id }).map((p) => ({
      id: p.id,
      date: p.date,
      invoiceId: p.invoiceId,
      invoiceNumber: invoices.find((i) => i.id === p.invoiceId)?.number ?? p.invoiceId.toUpperCase(),
      method: p.method,
      amount: p.amount,
      note: p.note,
    })),
    events,
  };
}
