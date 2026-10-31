import type { Interval } from "@/lib/dates";
import type { InvoiceDisplayStatus } from "@/features/invoices/schemas";

export type PaymentMethod = "upi" | "card" | "bank_transfer" | "cash";
export const PAYMENT_METHODS: PaymentMethod[] = ["upi", "card", "bank_transfer", "cash"];

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};

export const INTERVAL_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" } as const;

export type DraftLine = {
  id: string;
  description: string;
  qty: number;
  /** paise */
  unitPrice: number;
  /** paise taken off this line (already applied by the backend) */
  discount: number;
  discountName: string | null;
  /** percent, e.g. 18 or 12.5 */
  taxRate: number;
};

export type DraftContext = {
  planName: string;
  interval: Interval;
  startDate: string;
  invoicesIssued: number;
  lastPayment: { date: string; amount: number; method: PaymentMethod } | null;
  openBalance: number;
  overdueBalance: number;
  overdueCount: number;
  /** The customer's latest invoices, newest first (at most 3). */
  recentInvoices: { id: string; number: string; issueDate: string; total: number; status: InvoiceDisplayStatus }[];
};

/** One billing period of one due subscription, priced by the backend preview. */
export type DraftInvoice = {
  /** `<subscriptionId>:<periodStart>`: unique per card. */
  id: string;
  /** Null until the invoice is created: numbers are only allocated on insert. */
  invoiceNumber: string | null;
  subscriptionId: string;
  subscriptionNumber: string;
  customerId: string;
  customerName: string;
  /** Company or address line under the customer name. */
  location: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  paymentTerms: string;
  lines: DraftLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  context: DraftContext;
};

export const draftLabel = (d: Pick<DraftInvoice, "invoiceNumber">) => d.invoiceNumber ?? "New invoice";

export const lineGross = (l: Pick<DraftLine, "qty" | "unitPrice">) => l.qty * l.unitPrice;
