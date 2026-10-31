import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, not, or, sql } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { activityLog, invoices, payments, subscriptions, user } from "@/db/schema";

export type ActivityEntityType =
  | "subscription"
  | "invoice"
  | "payment"
  | "discount"
  | (string & {});

export type LogActivityInput = {
  entityType: ActivityEntityType;
  entityId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorId?: string | null;
  meta?: Record<string, unknown> | null;
};

export type ActivityItem = {
  at: Date;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  meta: unknown;
};

export async function logActivity(tx: DB | Tx, input: LogActivityInput): Promise<void> {
  await tx.insert(activityLog).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    actorId: input.actorId ?? null,
    meta: input.meta ?? null,
  });
}

/** Newest first. */
export async function listActivity(
  db: DB | Tx,
  entityType: ActivityEntityType,
  entityId: string,
): Promise<ActivityItem[]> {
  return db
    .select({
      at: activityLog.at,
      action: activityLog.action,
      fromStatus: activityLog.fromStatus,
      toStatus: activityLog.toStatus,
      actorName: user.name,
      meta: activityLog.meta,
    })
    .from(activityLog)
    .leftJoin(user, eq(user.id, activityLog.actorId))
    .where(and(eq(activityLog.entityType, entityType), eq(activityLog.entityId, entityId)))
    .orderBy(desc(activityLog.at), desc(activityLog.id));
}

export type RecentActivityItem = {
  at: Date;
  entityType: ActivityEntityType;
  entityId: string;
  /** SUB-… / INV-… number; for payments, the invoice number. Falls back to the entity id. */
  entityLabel: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  sentence: string;
};

const SUBSCRIPTION_VERBS: Record<string, string> = {
  draft: "moved to draft",
  quotation: "quoted",
  confirmed: "confirmed",
  active: "activated",
  paused: "paused",
  closed: "closed",
};

const INVOICE_VERBS: Record<string, string> = {
  draft: "moved to draft",
  confirmed: "confirmed",
  paid: "marked paid",
  cancelled: "cancelled",
};

function describeActivity(
  entityType: string,
  label: string,
  action: string,
  toStatus: string | null,
  actorName: string | null,
): string {
  const by = actorName ? ` by ${actorName}` : "";
  if (entityType === "payment") {
    if (action === "deleted") return `Payment removed from ${label}${by}`;
    return `Payment recorded on ${label}${by}`;
  }
  if (action === "sent") return `${label} sent`;
  if (action.startsWith("status:")) {
    const to = toStatus ?? action.slice("status:".length);
    const verbs = entityType === "invoice" ? INVOICE_VERBS : SUBSCRIPTION_VERBS;
    const verb = verbs[to] ?? `moved to ${to}`;
    return actorName ? `${label} ${verb}${by}` : `${label} ${verb} automatically`;
  }
  const verb = action.replace(/_/g, " ");
  return `${label} ${verb}${by}`;
}

/**
 * Newest-first feed across entities for the dashboard. Labels are resolved with LEFT JOINs.
 * Invoice-side `payment_recorded` / `payment_deleted` rows are skipped: the payment entity's own
 * row already represents the same event.
 */
export async function listRecentActivity(
  db: DB | Tx,
  opts: { limit?: number; entityTypes?: ActivityEntityType[] } = {},
): Promise<RecentActivityItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 200);
  const paymentInvoice = alias(invoices, "payment_invoice");
  const isSub = sql`${activityLog.entityType} = 'subscription'`;
  const isInv = sql`${activityLog.entityType} = 'invoice'`;

  const rows = await db
    .select({
      at: activityLog.at,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      action: activityLog.action,
      fromStatus: activityLog.fromStatus,
      toStatus: activityLog.toStatus,
      actorName: user.name,
      subNumber: subscriptions.number,
      invNumber: invoices.number,
      payInvNumber: paymentInvoice.number,
    })
    .from(activityLog)
    .leftJoin(user, eq(user.id, activityLog.actorId))
    .leftJoin(subscriptions, and(isSub, sql`${subscriptions.id}::text = ${activityLog.entityId}`))
    .leftJoin(invoices, and(isInv, sql`${invoices.id}::text = ${activityLog.entityId}`))
    .leftJoin(
      payments,
      and(sql`${activityLog.entityType} = 'payment'`, sql`${payments.id}::text = ${activityLog.entityId}`),
    )
    // Deleted payments no longer exist, so fall back to the invoice id stored in meta.
    .leftJoin(
      paymentInvoice,
      and(
        sql`${activityLog.entityType} = 'payment'`,
        sql`${paymentInvoice.id}::text = coalesce(${payments.invoiceId}::text, ${activityLog.meta}->>'invoiceId')`,
      ),
    )
    .where(
      and(
        opts.entityTypes?.length ? inArray(activityLog.entityType, opts.entityTypes) : undefined,
        not(
          and(isInv, or(eq(activityLog.action, "payment_recorded"), eq(activityLog.action, "payment_deleted")))!,
        ),
      ),
    )
    .orderBy(desc(activityLog.at), desc(activityLog.id))
    .limit(limit);

  return rows.map((r) => {
    const entityLabel = r.subNumber ?? r.invNumber ?? r.payInvNumber ?? r.entityId;
    return {
      at: r.at,
      entityType: r.entityType,
      entityId: r.entityId,
      entityLabel,
      action: r.action,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      actorName: r.actorName,
      sentence: describeActivity(r.entityType, entityLabel, r.action, r.toStatus, r.actorName),
    };
  });
}
