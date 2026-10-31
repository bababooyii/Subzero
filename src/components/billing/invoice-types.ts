import type { StatusKey } from "@/components/ui/StatusDot";
import type { InvoiceDisplayStatus, InvoiceStatus } from "@/features/invoices/schemas";
import type { PaymentMethod } from "./draft";

export type InvoiceLineView = {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  /** percent, e.g. 18 or 12.5 */
  taxRate: number;
  /** qty × unit price, before discount */
  gross: number;
  discount: number;
  /** after discount, before tax */
  amount: number;
  tax: number;
};

export type InvoicePayment = { id: string; date: string; method: PaymentMethod; amount: number; note: string };

export type InvoiceDetail = {
  id: string;
  number: string;
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
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
  /** The customer has been emailed the invoice. */
  sent: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  /** Newest first. */
  payments: InvoicePayment[];
  events: { id: string; at: string; text: string }[];
};

/** Backend display status → the StatusDot key. */
export function statusKeyOf(s: InvoiceDisplayStatus): StatusKey {
  return s === "partially_paid" ? "partial" : s;
}

type RawLine = {
  id: string;
  description: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  taxRateBps: number;
  discountAmount: number;
  taxAmount: number;
};

export function toLineView(l: RawLine): InvoiceLineView {
  const gross = l.quantity * l.unitPrice;
  return {
    id: l.id,
    description: l.variantLabel ? `${l.description} · ${l.variantLabel}` : l.description,
    qty: l.quantity,
    unitPrice: l.unitPrice,
    taxRate: l.taxRateBps / 100,
    gross,
    discount: l.discountAmount,
    amount: gross - l.discountAmount,
    tax: l.taxAmount,
  };
}
