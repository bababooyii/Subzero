import { and, eq, sql } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import {
  paymentTerms,
  plans,
  productTaxes,
  productVariants,
  products,
  quotationTemplateLines,
  quotationTemplates,
  subscriptionLines,
  subscriptions,
  taxes,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { addDays, addInterval } from "@/lib/dates";
import { logActivity } from "@/server/activity-log";
import { transitionSubscription } from "@/server/state-machine";
import type { SubscriptionAction, SubscriptionStatus } from "@/server/state-machine";
import {
  applyActionInput,
  fromTemplateInput,
  renewInput,
  subscriptionInput,
  type ApplyActionInput,
  type FromTemplateInput,
  type SubscriptionInput,
  type SubscriptionInputParsed,
} from "./schemas";

type Executor = DB | Tx;

export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionError";
  }
}

const EDITABLE: readonly SubscriptionStatus[] = ["draft", "quotation"];

const ACTION_TARGET: Record<SubscriptionAction, SubscriptionStatus> = {
  send_quotation: "quotation",
  confirm: "confirmed",
  activate: "active",
  pause: "paused",
  resume: "active",
  close: "closed",
  cancel: "closed",
  revise: "draft",
};

/**
 * Catalog price of one unit (paise) plus the tax rates (bps) of the product.
 * TODO: switch to @/features/catalog/queries lineUnitPrice after lane B merges
 */
export async function subscriptionLinePrice(
  db: Executor,
  productId: string,
  variantId: string | null,
): Promise<{ unitPrice: number; taxRatesBps: number[] }> {
  const [product] = await db
    .select({ salesPrice: products.salesPrice })
    .from(products)
    .where(eq(products.id, productId));
  if (!product) throw new SubscriptionError("Product not found");

  let extra = 0;
  if (variantId) {
    const [variant] = await db
      .select({ extraPrice: productVariants.extraPrice })
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
    if (!variant) throw new SubscriptionError("Variant does not belong to the product");
    extra = variant.extraPrice;
  }

  const rates = await db
    .select({ rateBps: taxes.rateBps })
    .from(productTaxes)
    .innerJoin(taxes, eq(taxes.id, productTaxes.taxId))
    .where(and(eq(productTaxes.productId, productId), eq(taxes.active, true)));

  return { unitPrice: product.salesPrice + extra, taxRatesBps: rates.map((r) => r.rateBps) };
}

async function nextNumber(db: Executor): Promise<string> {
  const rows = await db.execute<{ n: string }>(sql`select nextval('subscription_number_seq')::text as n`);
  return `SUB-${String(rows[0].n).padStart(4, "0")}`;
}

async function resolveLines(
  db: Executor,
  plan: { minQty: number },
  lines: SubscriptionInputParsed["lines"],
) {
  const out: { productId: string; variantId: string | null; quantity: number; unitPrice: number }[] = [];
  for (const line of lines) {
    if (line.quantity < plan.minQty) {
      throw new SubscriptionError(`Minimum quantity for this plan is ${plan.minQty}`);
    }
    const unitPrice =
      line.unitPrice ?? (await subscriptionLinePrice(db, line.productId, line.variantId)).unitPrice;
    out.push({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice,
    });
  }
  return out;
}

async function loadPlanAndTerm(db: Executor, planId: string, paymentTermId: string) {
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!plan) throw new SubscriptionError("Plan not found");
  const [term] = await db.select({ id: paymentTerms.id }).from(paymentTerms).where(eq(paymentTerms.id, paymentTermId));
  if (!term) throw new SubscriptionError("Payment term not found");
  return plan;
}

export async function createSubscription(db: Executor, input: SubscriptionInput, actor: Actor) {
  const data = subscriptionInput.parse(input);
  const plan = await loadPlanAndTerm(db, data.planId, data.paymentTermId);
  const lines = await resolveLines(db, plan, data.lines);

  const number = await nextNumber(db);
  const [sub] = await db
    .insert(subscriptions)
    .values({
      number,
      customerId: data.customerId,
      planId: data.planId,
      startDate: data.startDate,
      expiryDate: data.expiryDate,
      paymentTermId: data.paymentTermId,
      createdBy: actor.id,
    })
    .returning();
  await db.insert(subscriptionLines).values(lines.map((l) => ({ ...l, subscriptionId: sub.id })));
  await logActivity(db, {
    entityType: "subscription",
    entityId: sub.id,
    action: "created",
    toStatus: sub.status,
    actorId: actor.id,
  });
  return sub;
}

export async function createFromTemplate(db: Executor, input: FromTemplateInput, actor: Actor) {
  const data = fromTemplateInput.parse(input);
  const [tpl] = await db.select().from(quotationTemplates).where(eq(quotationTemplates.id, data.templateId));
  if (!tpl) throw new SubscriptionError("Template not found");
  if (!tpl.planId || !tpl.paymentTermId) {
    throw new SubscriptionError("Template needs a plan and payment term");
  }
  const tplLines = await db
    .select()
    .from(quotationTemplateLines)
    .where(eq(quotationTemplateLines.templateId, tpl.id));
  if (tplLines.length === 0) throw new SubscriptionError("Template has no lines");

  const plan = await loadPlanAndTerm(db, tpl.planId, tpl.paymentTermId);
  const lines = await resolveLines(
    db,
    plan,
    tplLines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
  );

  const number = await nextNumber(db);
  const [sub] = await db
    .insert(subscriptions)
    .values({
      number,
      customerId: data.customerId,
      planId: tpl.planId,
      startDate: data.startDate,
      paymentTermId: tpl.paymentTermId,
      templateId: tpl.id,
      quotationValidUntil: addDays(data.startDate, tpl.validityDays),
      createdBy: actor.id,
    })
    .returning();
  await db.insert(subscriptionLines).values(lines.map((l) => ({ ...l, subscriptionId: sub.id })));
  await logActivity(db, {
    entityType: "subscription",
    entityId: sub.id,
    action: "created",
    toStatus: sub.status,
    actorId: actor.id,
    meta: { templateId: tpl.id },
  });
  return sub;
}

/** Only while draft or quotation. Replaces the header fields and all lines. */
export async function updateSubscription(db: Executor, id: string, input: SubscriptionInput, actor: Actor) {
  const data = subscriptionInput.parse(input);
  const [current] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).for("update");
  if (!current) throw new SubscriptionError("Subscription not found");
  if (!EDITABLE.includes(current.status)) {
    throw new SubscriptionError("Only draft or quotation subscriptions can be edited");
  }
  const plan = await loadPlanAndTerm(db, data.planId, data.paymentTermId);
  const lines = await resolveLines(db, plan, data.lines);

  const [sub] = await db
    .update(subscriptions)
    .set({
      customerId: data.customerId,
      planId: data.planId,
      startDate: data.startDate,
      expiryDate: data.expiryDate,
      paymentTermId: data.paymentTermId,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))
    .returning();
  await db.delete(subscriptionLines).where(eq(subscriptionLines.subscriptionId, id));
  await db.insert(subscriptionLines).values(lines.map((l) => ({ ...l, subscriptionId: id })));
  await logActivity(db, { entityType: "subscription", entityId: id, action: "updated", actorId: actor.id });
  return sub;
}

export async function applyAction(db: Executor, input: ApplyActionInput, actor: Actor) {
  const data = applyActionInput.parse(input);
  return transitionSubscription(db, {
    id: data.id,
    to: ACTION_TARGET[data.action],
    actor,
  });
}

/** Extends the expiry date by one plan period. Not a status change. */
export async function renewSubscription(db: Executor, input: { id: string }, actor: Actor) {
  const data = renewInput.parse(input);
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, data.id)).for("update");
  if (!sub) throw new SubscriptionError("Subscription not found");
  const [plan] = await db.select().from(plans).where(eq(plans.id, sub.planId));
  if (!plan) throw new SubscriptionError("Plan not found");
  if (!plan.renewable) throw new SubscriptionError("Plan does not allow renewal");
  if (sub.status !== "active" && sub.status !== "paused") {
    throw new SubscriptionError("Only active or paused subscriptions can be renewed");
  }
  if (!sub.expiryDate) throw new SubscriptionError("Subscription has no expiry date to extend");

  const expiryDate = addInterval(sub.expiryDate, plan.interval, plan.intervalCount);
  const [updated] = await db
    .update(subscriptions)
    .set({ expiryDate, updatedAt: new Date() })
    .where(eq(subscriptions.id, data.id))
    .returning();
  await logActivity(db, {
    entityType: "subscription",
    entityId: data.id,
    action: "renewed",
    actorId: actor.id,
    meta: { from: sub.expiryDate, to: expiryDate },
  });
  return updated;
}
