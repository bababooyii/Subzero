import { headers } from "next/headers";
import { auth } from "./index";

export type Role = "admin" | "staff" | "customer";
export type Actor = { id: string; role: Role };

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

type SessionUser = { id: string; role?: string | null };

export function hasRole(
  user: { role?: string | null } | null | undefined,
  ...roles: Role[]
): boolean {
  return !!user && roles.includes(user.role as Role);
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session.user;
}

/** Throws ForbiddenError unless the signed-in user has one of `roles` (no hierarchy). */
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!hasRole(user, ...roles)) throw new ForbiddenError();
  return user;
}

export async function requireActor(...roles: Role[]): Promise<Actor> {
  const user: SessionUser = roles.length
    ? await requireRole(...roles)
    : await requireUser();
  return { id: user.id, role: (user.role ?? "customer") as Role };
}
