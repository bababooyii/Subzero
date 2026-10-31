"use server";

import { db } from "@/db/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireActor } from "@/lib/auth/session";
import { listRecentActivity, type RecentActivityItem } from "@/server/activity-log";

export async function recentActivityAction(
  opts: { limit?: number } = {},
): Promise<ActionResult<RecentActivityItem[]>> {
  try {
    await requireActor("admin", "staff");
    return ok(await listRecentActivity(db, { limit: opts.limit }));
  } catch (err) {
    if (err instanceof Error && err.name === "ForbiddenError") return fail("Forbidden");
    throw err;
  }
}
