import { redirect } from "next/navigation";
import { getSession, hasRole, type Role } from "@/lib/auth/session";

export type ShellUser = { id: string; name: string; email: string; role: Role };

async function currentUser(): Promise<ShellUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id, name, email, role } = session.user as { id: string; name: string; email: string; role?: string | null };
  return { id, name, email, role: (role ?? "customer") as Role };
}

/** Back-office pages: signed-out users go to /login, customers to the portal. */
export async function requireStaffUser(): Promise<ShellUser & { role: "admin" | "staff" }> {
  const user = await currentUser();
  if (!hasRole(user, "admin", "staff")) redirect("/portal");
  return user as ShellUser & { role: "admin" | "staff" };
}

/** Portal pages: signed-out users go to /login, staff back to the dashboard. */
export async function requireCustomerUser(): Promise<ShellUser & { role: "customer" }> {
  const user = await currentUser();
  if (!hasRole(user, "customer")) redirect("/dashboard");
  return user as ShellUser & { role: "customer" };
}
