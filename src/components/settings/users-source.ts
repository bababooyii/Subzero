import { db } from "@/db/client";
import { listUsers } from "@/features/users/queries";

/** A back-office team member (admin or staff). */
export type TeamUser = { id: string; name: string; email: string; role: "admin" | "staff" };

/**
 * Team list for Settings (admins and staff, by name). Admin-only: the page checks the role before calling,
 * which is why this reads `listUsers(db)` directly instead of going through `listUsersAction`.
 */
export async function listTeam(): Promise<TeamUser[]> {
  const params = { pageSize: 200, sort: "name", dir: "asc" } as const;
  const [admins, staff] = await Promise.all([listUsers(db, { ...params, role: "admin" }), listUsers(db, { ...params, role: "staff" })]);
  return [...admins.rows, ...staff.rows]
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role as TeamUser["role"] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
