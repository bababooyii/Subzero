import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db, type Tx } from "@/db/client";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import {
  ForbiddenError,
  requireActor,
  UnauthorizedError,
  type Actor,
  type Role,
} from "@/lib/auth/session";
import { ServiceError } from "./errors";

/**
 * Shared body of every server action: role guard, transaction, revalidation and
 * error mapping. Not a "use server" module, so it is never exposed as an action.
 */
export async function runAction<T>(
  roles: Role[],
  paths: string[],
  fn: (tx: Tx, actor: Actor) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const actor = await requireActor(...roles);
    const data = await db.transaction((tx) => fn(tx, actor));
    for (const p of paths) revalidatePath(p);
    return ok(data);
  } catch (err) {
    if (err instanceof ZodError) return fromZodError(err);
    if (err instanceof ServiceError) return fail(err.message, err.fieldErrors);
    if (err instanceof ForbiddenError) return fail("Forbidden");
    if (err instanceof UnauthorizedError) return fail("Not signed in");
    console.error(err);
    return fail("Something went wrong");
  }
}
