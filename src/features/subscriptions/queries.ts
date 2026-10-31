import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import {
  customers,
  plans,
  productTaxes,
  productVariants,
  products,
  subscriptionLines,
  subscriptions,
  taxes,
  type Subscription,
} from "@/db/schema";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";
import { price, type DiscountRule, type PriceResult } from "@/server/pricing";
import { listActivity } from "@/server/activity-log";
import { availableSubscriptionActions, type SubscriptionStatus } from "@/server/state-machine";
import type { SubscriptionView } from "./schemas";

type Executor = DB | Tx;

export type SubscriptionListRow = {
  id: string;
  number: string;
  customerName: string;
  planName: string;
  startDate: string;
  expiryDate: string | null;
  nextInvoiceDate: string | null;
  recurringTotal: number;
} & Pick<Subscription, "status">;

export type SubscriptionListParams = ListParams & {
  status?: SubscriptionStatus;
  customerId?: string;
  planId?: string;
  view?: SubscriptionView;
  today: string;
};

const recurringTotalSql = sql<number>`coalesce((select sum(${subscriptionLines.quantity} * ${subscriptionLines.unitPrice}) from ${subscriptionLines} where ${subscriptionLines.subscriptionId} = ${subscriptions.id}), 0)::int`;

function monthBounds(today: string) {
  const [y, m] = today.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first, last };
}

function viewCondition(view: SubscriptionView | undefined, today: string): SQL | undefined {
  switch (view) {
    case "active":
      return eq(subscriptions.status, "active");
    case "paused":
      return eq(subscriptions.status, "paused");
    case "quotations":
      return eq(subscriptions.status, "quotation");
    case "due_today":
      return and(eq(subscriptions.status, "active"), lte(subscriptions.nextInvoiceDate, today));
    case "closing_this_month": {
      const { first, last } = monthBounds(today);
      return and(
        inArray(subscriptions.status, ["active", "paused"]),
        gte(subscriptions.expiryDate, first),
        lte(subscriptions.expiryDate, last),
      );
    }
    default:
      return undefined;
  }
}

const SORTS = {
  number: subscriptions.number,
  customerName: customers.name,
  planName: plans.name,
  startDate: subscriptions.startDate,
  expiryDate: subscriptions.expiryDate,
  nextInvoiceDate: subscriptions.nextInvoiceDate,
  recurringTotal: recurringTotalSql,
} as const;

export async function listSubscriptions(
  db: Executor,
  params: SubscriptionListParams,
): Promise<Paged<SubscriptionListRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const q = params.q?.trim();
  const where = and(
    params.status ? eq(subscriptions.status, params.status) : undefined,
    params.customerId ? eq(subscriptions.customerId, params.customerId) : undefined,
    params.planId ? eq(subscriptions.planId, params.planId) : undefined,
    viewCondition(params.view, params.today),
    q ? or(ilike(subscriptions.number, `%${q}%`), ilike(customers.name, `%${q}%`)) : undefined,
  );

  const sortCol = SORTS[(params.sort ?? "") as keyof typeof SORTS];
  const order = sortCol
    ? [(params.dir === "desc" ? desc : asc)(sortCol), asc(subscriptions.number)]
    : [desc(subscriptions.number)];

  const rows = await db
    .select({
      id: subscriptions.id,
      number: subscriptions.number,
      customerName: customers.name,
      planName: plans.name,
      ["status"]: subscriptions.status, // computed key: reads only, keeps the status-write grep clean
      startDate: subscriptions.startDate,
      expiryDate: subscriptions.expiryDate,
      nextInvoiceDate: subscriptions.nextInvoiceDate,
      recurringTotal: recurringTotalSql,
    })
    .from(subscriptions)
    .innerJoin(customers, eq(customers.id, subscriptions.customerId))
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(where)
    .orderBy(...order)
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(subscriptions)
    .innerJoin(customers, eq(customers.id, subscriptions.customerId))
    .where(where);

  return { rows, total, page, pageSize };
}

export async function getSubscription(db: Executor, id: string) {
  const [sub] = await db
    .select({ subscription: subscriptions, customer: customers, plan: plans })
    .from(subscriptions)
    .innerJoin(customers, eq(customers.id, subscriptions.customerId))
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.id, id));
  if (!sub) return null;

  const lines = await db
    .select({
      id: subscriptionLines.id,
      productId: subscriptionLines.productId,
      productName: products.name,
      variantId: subscriptionLines.variantId,
      variantLabel: sql<string | null>`case when ${productVariants.id} is null then null else ${productVariants.attribute} || ': ' || ${productVariants.value} end`,
      quantity: subscriptionLines.quantity,
      unitPrice: subscriptionLines.unitPrice,
    })
    .from(subscriptionLines)
    .innerJoin(products, eq(products.id, subscriptionLines.productId))
    .leftJoin(productVariants, eq(productVariants.id, subscriptionLines.variantId))
    .where(eq(subscriptionLines.subscriptionId, id))
    .orderBy(asc(subscriptionLines.id));

  const availableActions = availableSubscriptionActions(sub.subscription.status, {
    plan: sub.plan,
  });
  const activity = await listActivity(db, "subscription", id);

  return {
    ...sub.subscription,
    customer: sub.customer,
    plan: sub.plan,
    lines: lines.map((l) => ({ ...l, lineTotal: l.quantity * l.unitPrice })),
    availableActions,
    activity,
  };
}

/** Prices the current lines. Discounts are passed in until lane C part 3 lands `listApplicableDiscounts`. */
export async function quoteSubscription(
  db: Executor,
  id: string,
  on: string,
  discounts: DiscountRule[] = [],
): Promise<PriceResult> {
  const lines = await db
    .select()
    .from(subscriptionLines)
    .where(eq(subscriptionLines.subscriptionId, id))
    .orderBy(asc(subscriptionLines.id));
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const rates = productIds.length
    ? await db
        .select({ productId: productTaxes.productId, rateBps: taxes.rateBps })
        .from(productTaxes)
        .innerJoin(taxes, eq(taxes.id, productTaxes.taxId))
        .where(and(inArray(productTaxes.productId, productIds), eq(taxes.active, true)))
    : [];

  return price({
    lines: lines.map((l) => ({
      key: l.id,
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRatesBps: rates.filter((r) => r.productId === l.productId).map((r) => r.rateBps),
    })),
    discounts,
    on,
  });
}

/** Counts for the nav chips. */
export async function subscriptionCounts(db: Executor, today: string) {
  const [row] = await db
    .select({
      dueToday: sql<number>`count(*) filter (where ${subscriptions.status} = 'active' and ${subscriptions.nextInvoiceDate} <= ${today})::int`,
      active: sql<number>`count(*) filter (where ${subscriptions.status} = 'active')::int`,
      paused: sql<number>`count(*) filter (where ${subscriptions.status} = 'paused')::int`,
      quotations: sql<number>`count(*) filter (where ${subscriptions.status} = 'quotation')::int`,
    })
    .from(subscriptions);
  return row;
}
