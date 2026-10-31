import type { InvoiceRow, TimelineRow } from "@/components/subscriptions/rows";
import type { PaymentMethod } from "@/components/subscriptions/labels";
import type { SubscriptionListRow } from "@/features/subscriptions/queries";

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
  company: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  createdAt: string;
  activeSubscriptions: number;
  outstanding: number;
  overdue: number;
  /** Totals behind the tab counts (the tables carry at most the newest 100). */
  counts: { subscriptions: number; invoices: number; payments: number };
  subscriptions: SubscriptionListRow[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  events: TimelineRow[];
};
