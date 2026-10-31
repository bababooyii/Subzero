import { db } from "@/db/client";
import { listRecentActivity } from "@/server/activity-log";

/** One line of the dashboard's Recent activity card, e.g. "INV-0142 confirmed by Asha". `href` is the record it is about, when it has a page. */
export type RecentActivityItem = { id: string; at: string; sentence: string; href?: string };

const hrefOf = (entityType: string, entityId: string) =>
  entityType === "subscription" ? `/subscriptions/${entityId}` : entityType === "invoice" ? `/invoices/${entityId}` : undefined;

export async function loadRecentActivity(limit: number): Promise<RecentActivityItem[]> {
  const rows = await listRecentActivity(db, { limit });
  return rows.map((r) => {
    const at = r.at.toISOString();
    return { id: `${r.entityType}:${r.entityId}:${r.action}:${at}`, at, sentence: r.sentence, href: hrefOf(r.entityType, r.entityId) };
  });
}
