"use server";

import { db } from "@/db/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireRole } from "@/lib/auth/session";
import { globalSearch, type SearchResults } from "./queries";

export async function globalSearchAction(q: string): Promise<ActionResult<SearchResults>> {
  try {
    await requireRole("admin", "staff");
  } catch {
    return fail("Forbidden");
  }
  try {
    return ok(await globalSearch(db, String(q ?? "")));
  } catch (err) {
    console.error(err);
    return fail("Something went wrong");
  }
}
