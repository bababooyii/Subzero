import { asc, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";

/** A back-office team member (admin or staff). */
export type TeamUser = { id: string; name: string; email: string; role: "admin" | "staff" };

/**
 * Team list for Settings. Admin-only: the page checks the role before calling.
 * TODO(backend): swap to listUsers(db) / listUsersAction() from `@/features/users/queries`.
 */
export async function listTeam(): Promise<TeamUser[]> {
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(ne(user.role, "customer"))
    .orderBy(asc(user.name));
  return rows as TeamUser[];
}
