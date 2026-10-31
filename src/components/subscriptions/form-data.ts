import { asc } from "drizzle-orm";
import type { DB } from "@/db/client";
import { customers } from "@/db/schema";
import { getTemplate, listPaymentTerms, listPlans, listTaxes, listTemplates, productOptions, type ProductOption } from "@/features/catalog/queries";
import { listApplicableDiscounts } from "@/features/discounts/queries";
import type { DiscountRule } from "@/server/pricing";
import type { Interval } from "./labels";

/** Everything the new-subscription form needs, as plain serialisable data. */
export type NewSubscriptionData = {
  customers: { id: string; name: string }[];
  plans: { id: string; name: string; interval: Interval; minQty: number }[];
  products: ProductOption[];
  templates: {
    id: string;
    name: string;
    validityDays: number;
    planId: string | null;
    paymentTermId: string | null;
    lines: { productId: string; variantId: string | null; qty: number }[];
  }[];
  taxes: { id: string; name: string; rateBps: number }[];
  paymentTerms: { id: string; name: string; dueDays: number }[];
  /** Discounts the server would apply today. They are automatic: the form only previews them. */
  discounts: DiscountRule[];
  today: string;
};

export async function loadNewSubscriptionData(db: DB, today: string): Promise<NewSubscriptionData> {
  const [customerRows, planPage, products, templatePage, taxes, paymentTerms] = await Promise.all([
    db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(asc(customers.name), asc(customers.id)),
    listPlans(db, { active: true, pageSize: 200 }),
    productOptions(db),
    listTemplates(db, { pageSize: 200 }),
    listTaxes(db),
    listPaymentTerms(db),
  ]);
  const [templates, discounts] = await Promise.all([
    Promise.all(templatePage.rows.map((t) => getTemplate(db, t.id))),
    listApplicableDiscounts(db, { productIds: products.map((p) => p.id), on: today }),
  ]);

  return {
    customers: customerRows,
    // Only plans that are on sale today.
    plans: planPage.rows
      .filter((p) => (!p.availableFrom || p.availableFrom <= today) && (!p.availableTo || p.availableTo >= today))
      .map((p) => ({ id: p.id, name: p.name, interval: p.interval, minQty: p.minQty })),
    products,
    templates: templates.flatMap((t) =>
      t
        ? [
            {
              id: t.id,
              name: t.name,
              validityDays: t.validityDays,
              planId: t.planId,
              paymentTermId: t.paymentTermId,
              lines: t.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.quantity })),
            },
          ]
        : [],
    ),
    taxes: taxes.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name, rateBps: t.rateBps })),
    paymentTerms,
    discounts,
    today,
  };
}
