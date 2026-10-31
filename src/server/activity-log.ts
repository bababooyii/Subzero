import { desc, eq, and } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { activityLog, user } from "@/db/schema";

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
