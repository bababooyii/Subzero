import { eq } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { customers } from "@/db/schema";
import type { Actor } from "@/lib/auth/session";

export type Db = DB | Tx;

/**
 * The customers row linked to a portal user, or null if the actor is not a customer
 * or has no linked row. Every portal read/write scopes by the id this returns.
 */
export async function resolveCustomerId(db: Db, actor: Actor): Promise<string | null> {
  if (actor.role !== "customer") return null;
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.userId, actor.id))
    .limit(1);
  return row?.id ?? null;
}
