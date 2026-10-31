/** Selectors for the billing run, invoices and payments screens. Plain serialisable output so it can cross into client components. */
import { addDays, getDb } from "./data";
import {
  customerName,
  dueForBilling,
  entityActivity,
  getCustomer,
  getInvoice,
  getPlan,
  getSubscription,
  invoiceBalance,
  invoiceDisplayStatus,
  isOverdue,
  listPayments,
  subscriptionMrr,
} from "./selectors";
import type { Interval, InvoiceDisplayStatus, InvoiceStatus, PaymentMethod } from "./types";

const termDays = (terms: string) => (terms === "Immediate" ? 0 : terms === "Net 15" ? 15 : 30);

/* ---------- billing run ---------- */

export type DraftLine = {
  id: string;
  description: string;
  qty: number;
  /** paise */
  unitPrice: number;
  discountType: "fixed" | "percent" | null;
  discountValue: number;
  discountName: string | null;
  /** whole percent */
  taxRate: number;
};

export type DraftContext = {
  planName: string;
  interval: Interval;
  startDate: string;
  nextBillingDate: string;
  mrr: number;
  invoicesIssued: number;
  lastPayment: { date: string; amount: number; method: PaymentMethod } | null;
  openBalance: number;
  overdueBalance: number;
  overdueCount: number;
  /** The customer's latest invoices, newest first (at most 3). */
  recentInvoices: { id: string; number: string; issueDate: string; total: number; status: InvoiceDisplayStatus }[];
};

export type DraftInvoice = {
  /** Same as the subscription id: one draft per due subscription. */
  id: string;
  invoiceNumber: string;
  subscriptionId: string;
  subscriptionNumber: string;
  customerId: string;
  customerName: string;
  city: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paymentTerms: string;
  lines: DraftLine[];
  context: DraftContext;
};

/** Draft invoices for every subscription that is due to bill (adaptation §6). */
export function billingRun(): DraftInvoice[] {
  const { invoices, discounts, taxes } = getDb();
  const maxNo = invoices.reduce((n, i) => Math.max(n, Number(i.number.slice(4)) || 0), 0);
  return dueForBilling().map((d, idx) => {
    const sub = d.subscription;
    const mine = invoices.filter((i) => i.subscriptionId === sub.id);
    const mineIds = new Set(mine.map((i) => i.id));
    const last = getDb().payments.filter((p) => mineIds.has(p.invoiceId))[0];
    const overdue = mine.filter(isOverdue);
    return {
      id: sub.id,
      invoiceNumber: `INV-${String(maxNo + idx + 1).padStart(4, "0")}`,
      subscriptionId: sub.id,
      subscriptionNumber: sub.number,
      customerId: d.customer.id,
      customerName: d.customer.name,
      city: d.customer.city,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
      dueDate: addDays(d.periodStart, termDays(sub.paymentTerms)),
      paymentTerms: sub.paymentTerms,
      lines: sub.lines.map((l) => {
        const dsc = l.discountId ? discounts.find((x) => x.id === l.discountId) : undefined;
        return {
          id: l.id,
          description: l.description,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discountType: dsc?.type ?? null,
          discountValue: dsc?.value ?? 0,
          discountName: dsc?.name ?? null,
          taxRate: taxes.find((t) => t.id === l.taxId)?.rate ?? 0,
        };
      }),
      context: {
        planName: d.plan.name,
        interval: d.plan.interval,
        startDate: sub.startDate,
        nextBillingDate: d.periodStart,
        mrr: subscriptionMrr(sub),
        invoicesIssued: mine.length,
        lastPayment: last ? { date: last.date, amount: last.amount, method: last.method } : null,
        openBalance: mine.reduce((n, i) => n + invoiceBalance(i), 0),
        overdueBalance: overdue.reduce((n, i) => n + invoiceBalance(i), 0),
        overdueCount: overdue.length,
        recentInvoices: invoices
          .filter((i) => i.customerId === d.customer.id)
          .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : a.number < b.number ? 1 : -1))
          .slice(0, 3)
          .map((i) => ({ id: i.id, number: i.number, issueDate: i.issueDate, total: i.total, status: invoiceDisplayStatus(i) })),
      },
    };
  });
}

/* ---------- invoices list ---------- */

export type InvoiceView = "all" | "draft" | "confirmed" | "paid" | "overdue" | "cancelled";
export const INVOICE_VIEWS: InvoiceView[] = ["all", "draft", "confirmed", "paid", "overdue", "cancelled"];

export type InvoiceRow = {
  id: string;
  number: string;
  customerId: string;
  customer: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceDisplayStatus;
  total: number;
  balance: number;
};

function inView(status: InvoiceDisplayStatus, view: InvoiceView): boolean {
  switch (view) {
    case "all":
      return true;
    case "confirmed":
      return status === "confirmed" || status === "partial";
    default:
      return status === view;
  }
}

export function invoiceRows(view: InvoiceView = "all"): InvoiceRow[] {
  return getDb()
    .invoices.filter((i) => inView(invoiceDisplayStatus(i), view))
    .map((i) => ({
      id: i.id,
      number: i.number,
      customerId: i.customerId,
      customer: customerName(i.customerId),
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      status: invoiceDisplayStatus(i),
      total: i.total,
      balance: invoiceBalance(i),
    }))
    .sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : a.number < b.number ? 1 : -1));
}

export function invoiceViewCounts(): Record<InvoiceView, number> & { outstanding: number } {
  const counts: Record<InvoiceView, number> = { all: 0, draft: 0, confirmed: 0, paid: 0, overdue: 0, cancelled: 0 };
  let outstanding = 0;
  for (const i of getDb().invoices) {
    const s = invoiceDisplayStatus(i);
    counts.all += 1;
    for (const v of INVOICE_VIEWS) if (v !== "all" && inView(s, v)) counts[v] += 1;
    outstanding += invoiceBalance(i);
  }
  return { ...counts, outstanding };
}

/* ---------- invoice record ---------- */

export type InvoiceLineView = {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  /** qty × unit price, before discount */
  gross: number;
  discount: number;
  /** after discount, before tax */
  amount: number;
  tax: number;
};

export type PaymentRow = {
  id: string;
  date: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customer: string;
  method: PaymentMethod;
  amount: number;
  note: string;
};

export type InvoiceDetail = {
  id: string;
  number: string;
  status: InvoiceStatus;
  customer: { id: string; name: string; contactName: string; email: string; city: string; gstin: string };
  subscription: { id: string; number: string; planName: string; paymentTerms: string } | null;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLineView[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  payments: PaymentRow[];
  events: { id: string; at: string; text: string }[];
};

function toPaymentRow(p: ReturnType<typeof listPayments>[number]): PaymentRow {
  return {
    id: p.id,
    date: p.date,
    invoiceId: p.invoiceId,
    invoiceNumber: getInvoice(p.invoiceId)?.number ?? p.invoiceId.toUpperCase(),
    customerId: p.customerId,
    customer: customerName(p.customerId),
    method: p.method,
    amount: p.amount,
    note: p.note,
  };
}

export function invoiceDetail(id: string): InvoiceDetail | null {
  const inv = getInvoice(id);
  if (!inv) return null;
  const customer = getCustomer(inv.customerId);
  const sub = getSubscription(inv.subscriptionId);
  const plan = sub ? getPlan(sub.planId) : undefined;
  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    customer: {
      id: inv.customerId,
      name: customer?.name ?? "Unknown customer",
      contactName: customer?.contactName ?? "",
      email: customer?.email ?? "",
      city: customer?.city ?? "",
      gstin: customer?.gstin ?? "",
    },
    subscription: sub ? { id: sub.id, number: sub.number, planName: plan?.name ?? "", paymentTerms: sub.paymentTerms } : null,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    lines: inv.lines.map((l) => {
      const gross = Math.round(l.qty * l.unitPrice);
      return {
        id: l.id,
        description: l.description,
        qty: l.qty,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        gross,
        discount: gross - l.amount,
        amount: l.amount,
        tax: Math.round((l.amount * l.taxRate) / 100),
      };
    }),
    subtotal: inv.subtotal,
    discountTotal: inv.discountTotal,
    taxTotal: inv.taxTotal,
    total: inv.total,
    amountPaid: inv.amountPaid,
    payments: listPayments({ invoiceId: inv.id }).map(toPaymentRow),
    // Payment events are filed under the invoice id too (see the mock data).
    events: [...entityActivity("invoice", inv.id), ...entityActivity("payment", inv.id)]
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .map((e) => ({ id: e.id, at: e.at, text: e.text })),
  };
}

/* ---------- payments ---------- */

export type PaymentMethodView = PaymentMethod | "all";
export const PAYMENT_METHODS: PaymentMethod[] = ["upi", "card", "bank_transfer", "cash"];

export function paymentRows(method: PaymentMethodView = "all"): PaymentRow[] {
  return listPayments()
    .filter((p) => method === "all" || p.method === method)
    .map(toPaymentRow)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
}

export type MethodTotal = { method: PaymentMethod; count: number; amount: number };

export function paymentMethodTotals(): { total: number; count: number; methods: MethodTotal[] } {
  const methods: MethodTotal[] = PAYMENT_METHODS.map((method) => ({ method, count: 0, amount: 0 }));
  for (const p of listPayments()) {
    const m = methods.find((x) => x.method === p.method)!;
    m.count += 1;
    m.amount += p.amount;
  }
  return { total: methods.reduce((n, m) => n + m.amount, 0), count: methods.reduce((n, m) => n + m.count, 0), methods };
}
