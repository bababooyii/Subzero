import { addDays, periodEnd, type Interval } from "@/lib/dates";
import { price, type DiscountRule, type PriceResult } from "@/server/pricing";

export type BuildInvoiceInput = {
  subscription: { id: string; number: string };
  customer: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    address: string | null;
    gstin: string | null;
  };
  plan: { interval: Interval; intervalCount: number };
  lines: {
    productId: string;
    productName: string;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
  }[];
  taxesByProduct: Record<string, number[]>; // product id -> tax rates in bps
  discounts: DiscountRule[];
  periodStart: string;
  termsDueDays: number;
  on: string;
};

export type BuiltInvoice = {
  header: {
    subscriptionId: string;
    customerId: string;
    customerSnapshot: {
      name: string;
      email: string;
      company: string | null;
      address: string | null;
      gstin: string | null;
    };
    periodStart: string;
    periodEnd: string;
    issuedOn: string;
    dueDate: string;
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
  };
  lines: {
    productId: string;
    description: string;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
    taxRateBps: number;
    discountAmount: number;
    taxAmount: number;
    lineTotal: number;
  }[];
  applied: PriceResult["applied"];
  rejected: PriceResult["rejected"];
};

/** Pure: prices the subscription lines for one period and shapes the rows to insert. */
export function buildInvoice(input: BuildInvoiceInput): BuiltInvoice {
  const { subscription, customer, plan, lines, taxesByProduct, discounts, periodStart, termsDueDays, on } = input;

  const priced = price({
    lines: lines.map((l, i) => ({
      key: String(i),
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRatesBps: taxesByProduct[l.productId] ?? [],
    })),
    discounts,
    on,
  });

  return {
    header: {
      subscriptionId: subscription.id,
      customerId: customer.id,
      customerSnapshot: {
        name: customer.name,
        email: customer.email,
        company: customer.company,
        address: customer.address,
        gstin: customer.gstin,
      },
      periodStart,
      periodEnd: periodEnd(periodStart, plan.interval, plan.intervalCount),
      issuedOn: on,
      dueDate: addDays(on, termsDueDays),
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      taxTotal: priced.taxTotal,
      total: priced.total,
    },
    lines: lines.map((l, i) => {
      const p = priced.lines[i];
      return {
        productId: l.productId,
        description: l.productName,
        variantLabel: l.variantLabel,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRateBps: p.taxRateBps,
        discountAmount: p.discount,
        taxAmount: p.tax,
        lineTotal: p.total,
      };
    }),
    applied: priced.applied,
    rejected: priced.rejected,
  };
}
