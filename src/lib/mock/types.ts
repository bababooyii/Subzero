/** Mock domain types. They mirror the planned data model. All money is integer paise. Dates are ISO strings. */

export type Role = "admin" | "staff" | "customer";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type Customer = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  gstin: string;
  createdAt: string;
};

export type ProductType = "service" | "software" | "hardware" | "addon";

export type ProductVariant = { attribute: string; value: string; extraPrice: number };

export type Product = {
  id: string;
  name: string;
  type: ProductType;
  salesPrice: number;
  costPrice: number;
  notes: string;
  variants: ProductVariant[];
  /** Default tax for the product. Undefined means GST 18%. */
  taxId?: string;
};

export type Tax = { id: string; name: string; rate: number };

export type Interval = "daily" | "weekly" | "monthly" | "yearly";

export type Plan = {
  id: string;
  name: string;
  price: number;
  interval: Interval;
  minQty: number;
  startDate: string;
  endDate: string | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
};

export type SubscriptionLine = {
  id: string;
  productId: string;
  description: string;
  variant?: string;
  qty: number;
  unitPrice: number;
  taxId: string;
  discountId?: string;
};

export type QuotationTemplate = {
  id: string;
  name: string;
  validityDays: number;
  planId: string;
  lines: { productId: string; qty: number }[];
};

export type SubscriptionStatus = "draft" | "quotation" | "confirmed" | "active" | "paused" | "closed";

export type Subscription = {
  id: string;
  number: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string;
  expiryDate: string;
  paymentTerms: string;
  nextBillingDate: string | null;
  lines: SubscriptionLine[];
};

export type Discount = {
  id: string;
  name: string;
  type: "fixed" | "percent";
  /** paise for fixed, whole percent for percent */
  value: number;
  minPurchase: number;
  minQty: number;
  start: string;
  end: string;
  usageLimit: number | null;
  timesUsed: number;
  scope: "products" | "subscription";
  targetIds: string[];
};

export type InvoiceStatus = "draft" | "confirmed" | "paid" | "cancelled";

export type InvoiceLine = {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
};

export type Invoice = {
  id: string;
  number: string;
  subscriptionId: string;
  customerId: string;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
};

export type PaymentMethod = "upi" | "card" | "bank_transfer" | "cash";

export type Payment = {
  id: string;
  invoiceId: string;
  customerId: string;
  method: PaymentMethod;
  amount: number;
  date: string;
  note: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  actor: string;
  entity: "subscription" | "invoice" | "payment" | "customer";
  entityId: string;
  text: string;
};

/** Derived presentation status for an invoice. */
export type InvoiceDisplayStatus =
  | "draft"
  | "confirmed"
  | "partial"
  | "overdue"
  | "paid"
  | "cancelled";

export type Db = {
  users: User[];
  customers: Customer[];
  products: Product[];
  taxes: Tax[];
  plans: Plan[];
  templates: QuotationTemplate[];
  discounts: Discount[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  payments: Payment[];
  events: ActivityEvent[];
};
