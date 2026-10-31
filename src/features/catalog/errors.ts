import type { Actor } from "@/lib/auth/session";

/** Expected, user-facing failure thrown by services; actions turn it into `fail(...)`. */
export class ServiceError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function assertRole(actor: Actor, ...roles: Actor["role"][]) {
  if (!roles.includes(actor.role)) throw new ServiceError("Forbidden");
}
