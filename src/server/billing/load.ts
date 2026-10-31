import { eq, inArray } from "drizzle-orm";
import {
  customers,
  paymentTerms,
  plans,
  productTaxes,
  productVariants,
  products,
  subscriptionLines,
  subscriptions,
  taxes,
} from "@/db/schema";
import type { Interval } from "@/lib/dates";
import type { BuildInvoiceInput } from "./build-invoice";
import type { DB, Tx } from "./types";

export type SubscriptionContext = {
  subscription: BuildInvoiceInput["subscription"] & {
    nextInvoiceDate: string | null;
    expiryDate: string | null;
  };
  customer: BuildInvoiceInput["customer"];
  plan: BuildInvoiceInput["plan"] & { autoClose: boolean };
  lines: BuildInvoiceInput["lines"];
  taxesByProduct: BuildInvoiceInput["taxesByProduct"];
  termsDueDays: number;
};

/** Loads everything needed to price a subscription's invoices. */
export async function loadContext(db: DB | Tx, subscriptionId: string): Promise<SubscriptionContext | null> {
  const [row] = await db
    .select({
      sub: subscriptions,
      customer: customers,
      plan: plans,
      dueDays: paymentTerms.dueDays,
    })
    .from(subscriptions)
    .innerJoin(customers, eq(customers.id, subscriptions.customerId))
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .leftJoin(paymentTerms, eq(paymentTerms.id, subscriptions.paymentTermId))
    .where(eq(subscriptions.id, subscriptionId));
  if (!row) return null;

  const lineRows = await db
    .select({
      productId: subscriptionLines.productId,
      productName: products.name,
      attribute: productVariants.attribute,
      value: productVariants.value,
      quantity: subscriptionLines.quantity,
      unitPrice: subscriptionLines.unitPrice,
    })
    .from(subscriptionLines)
    .innerJoin(products, eq(products.id, subscriptionLines.productId))
    .leftJoin(productVariants, eq(productVariants.id, subscriptionLines.variantId))
    .where(eq(subscriptionLines.subscriptionId, subscriptionId))
    .orderBy(subscriptionLines.id);

  const productIds = [...new Set(lineRows.map((l) => l.productId))];
  const taxesByProduct: Record<string, number[]> = {};
  if (productIds.length > 0) {
    const taxRows = await db
      .select({ productId: productTaxes.productId, rateBps: taxes.rateBps })
      .from(productTaxes)
      .innerJoin(taxes, eq(taxes.id, productTaxes.taxId))
      .where(inArray(productTaxes.productId, productIds));
    for (const t of taxRows) (taxesByProduct[t.productId] ??= []).push(t.rateBps);
  }

  return {
    subscription: {
      id: row.sub.id,
      number: row.sub.number,
      nextInvoiceDate: row.sub.nextInvoiceDate,
      expiryDate: row.sub.expiryDate,
    },
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      email: row.customer.email,
      company: row.customer.company,
      address: row.customer.address,
      gstin: row.customer.gstin,
    },
    plan: {
      interval: row.plan.interval as Interval,
      intervalCount: row.plan.intervalCount,
      autoClose: row.plan.autoClose,
    },
    lines: lineRows.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      variantLabel: l.attribute ? `${l.attribute}: ${l.value}` : null,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
    taxesByProduct,
    termsDueDays: row.dueDays ?? 0,
  };
}
