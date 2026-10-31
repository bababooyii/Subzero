import { eq } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { invoices, plans, quotationTemplates, subscriptions } from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { addDays, todayIST } from "@/lib/dates";
import { logActivity } from "@/server/activity-log";
import { InvalidTransitionError } from "./errors";
import { canTransitionInvoice, type InvoiceStatus } from "./invoice";
import { canTransitionSubscription, type SubscriptionStatus } from "./subscription";

export { InvalidTransitionError } from "./errors";
export * from "./subscription";
export * from "./invoice";

type Executor = DB | Tx;

const DEFAULT_QUOTATION_VALIDITY_DAYS = 30;

export async function transitionSubscription(
  tx: Executor,
  input: {
    id: string;
    to: SubscriptionStatus;
    actor: Actor | null;
    system?: boolean;
    reason?: string;
  },
) {
  const [sub] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, input.id))
    .for("update");
  if (!sub) throw new Error(`Subscription ${input.id} not found`);

  const [plan] = await tx.select().from(plans).where(eq(plans.id, sub.planId));
  if (!plan) throw new Error(`Plan ${sub.planId} not found`);

  const verdict = canTransitionSubscription(sub.status, input.to, {
    plan: {
      closable: plan.closable,
      pausable: plan.pausable,
      renewable: plan.renewable,
      autoClose: plan.autoClose,
    },
    system: input.system,
  });
  if (!verdict.ok) {
    throw new InvalidTransitionError("subscription", sub.status, input.to, verdict.reason);
  }

  const patch: Partial<typeof subscriptions.$inferInsert> = {
    status: input.to,
    updatedAt: new Date(),
  };
  if (input.to === "active") {
    patch.nextInvoiceDate = sub.nextInvoiceDate ?? sub.startDate;
  } else if (input.to === "closed") {
    patch.nextInvoiceDate = null;
  } else if (input.to === "quotation" && !sub.quotationValidUntil) {
    let days = DEFAULT_QUOTATION_VALIDITY_DAYS;
    if (sub.templateId) {
      const [tpl] = await tx
        .select({ validityDays: quotationTemplates.validityDays })
        .from(quotationTemplates)
        .where(eq(quotationTemplates.id, sub.templateId));
      if (tpl) days = tpl.validityDays;
    }
    patch.quotationValidUntil = addDays(todayIST(), days);
  }

  const [updated] = await tx
    .update(subscriptions)
    .set(patch)
    .where(eq(subscriptions.id, input.id))
    .returning();

  await logActivity(tx, {
    entityType: "subscription",
    entityId: input.id,
    action: `status:${input.to}`,
    fromStatus: sub.status,
    toStatus: input.to,
    actorId: input.actor?.id ?? null,
    meta: {
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.system ? { system: true } : {}),
    },
  });
  return updated;
}

export async function transitionInvoice(
  tx: Executor,
  input: { id: string; to: InvoiceStatus; actor: Actor | null; system?: boolean; reason?: string },
) {
  const [inv] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.id, input.id))
    .for("update");
  if (!inv) throw new Error(`Invoice ${input.id} not found`);

  const verdict = canTransitionInvoice(inv.status, input.to, {
    total: inv.total,
    amountPaid: inv.amountPaid,
  });
  if (!verdict.ok) {
    throw new InvalidTransitionError("invoice", inv.status, input.to, verdict.reason);
  }

  const [updated] = await tx
    .update(invoices)
    .set({ status: input.to, updatedAt: new Date() })
    .where(eq(invoices.id, input.id))
    .returning();

  await logActivity(tx, {
    entityType: "invoice",
    entityId: input.id,
    action: `status:${input.to}`,
    fromStatus: inv.status,
    toStatus: input.to,
    actorId: input.actor?.id ?? null,
    meta: {
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.system ? { system: true } : {}),
    },
  });
  return updated;
}
