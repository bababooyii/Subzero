import type { Interval } from "@/lib/dates";
import type { SubscriptionStatus } from "@/server/state-machine";

/** Plain, serialisable shapes the portal views render. Built on the server by `load.ts`. */
export type PortalLine = {
  id: string;
  description: string;
  variant?: string;
  qty: number;
  unitPrice: number;
  /** Percent, e.g. 18 for GST 18%. */
  taxRate: number;
  /** Quantity x unit price, pre-tax, paise. */
  amount: number;
};

export type PortalSub = {
  id: string;
  number: string;
  status: SubscriptionStatus;
  planName: string;
  interval: Interval;
  intervalCount: number;
  /** What the state machine allows this customer to do right now. */
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  startDate: string;
  expiryDate: string | null;
  quotationValidUntil: string | null;
  nextBillingDate: string | null;
  paymentTerms: string;
  /** Per-period total including tax, paise. */
  amount: number;
  totals: { subtotal: number; discountTotal: number; taxTotal: number; total: number };
  lines: PortalLine[];
};

export type PortalInvoiceStatus = "draft" | "confirmed" | "partial" | "overdue" | "paid" | "cancelled";

export type PortalInvoice = {
  id: string;
  number: string;
  subscriptionId: string;
  subscriptionNumber: string;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  status: PortalInvoiceStatus;
  total: number;
  balance: number;
};

/** The signed-in customer's own record. `name` is the company (or the contact when there is none). */
export type PortalCustomer = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  createdAt: string;
};

export type PortalData = {
  customer: PortalCustomer;
  /** Server "today" (IST), so derived figures agree between server and client render. */
  today: string;
  subs: PortalSub[];
  invoices: PortalInvoice[];
};

export type PortalEvent = { id: string; at: string; text: string };
