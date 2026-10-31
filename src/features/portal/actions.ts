"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { fail, type ActionResult } from "@/lib/action-result";
import { ForbiddenError, requireActor, UnauthorizedError } from "@/lib/auth/session";
import {
  cancelMySubscription,
  pauseMySubscription,
  resumeMySubscription,
  type PortalDeps,
} from "./service";

// TODO(wire-state-machine): lane C's `src/server/state-machine` is not on this branch yet.
// Once it lands, replace this with:
//   import { transitionSubscription } from "@/server/state-machine";
//   const deps: PortalDeps = {
//     transitionSubscription: (tx, { subscriptionId, to }, actor) =>
//       transitionSubscription(tx, subscriptionId, to, actor),
//   };
// and run each service call inside `db.transaction((tx) => ...)` so the status change and its
// activity_log row commit together. Adjust the argument order to the real signature.
const deps: PortalDeps = {
  transitionSubscription: async () => {
    throw new Error("State machine not wired yet (see TODO in portal/actions.ts)");
  },
};

async function guarded(
  fn: (actor: Awaited<ReturnType<typeof requireActor>>) => Promise<ActionResult<null>>,
): Promise<ActionResult<null>> {
  try {
    const result = await fn(await requireActor("customer"));
    if (result.ok) revalidatePath("/portal");
    return result;
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return fail(err.message);
    throw err;
  }
}

export async function pauseMySubscriptionAction(id: string) {
  return guarded((actor) => pauseMySubscription(db, actor, { id }, deps));
}
export async function resumeMySubscriptionAction(id: string) {
  return guarded((actor) => resumeMySubscription(db, actor, { id }, deps));
}
export async function cancelMySubscriptionAction(id: string) {
  return guarded((actor) => cancelMySubscription(db, actor, { id }, deps));
}
