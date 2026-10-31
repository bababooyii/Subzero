/** One line of the dashboard's Recent activity card, e.g. "INV-0142 confirmed by Asha". */
export type RecentActivityItem = { id: string; at: string; sentence: string };

/**
 * TODO(backend): swap the body for `listRecentActivity(db, { limit })` from `@/server/activity-log` once it lands
 * (it returns ready-made `sentence` strings). Until then the card shows its empty state.
 */
export async function loadRecentActivity(limit: number): Promise<RecentActivityItem[]> {
  void limit;
  return [];
}
