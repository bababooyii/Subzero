"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { fail, type ActionResult } from "@/lib/action-result";
import { ForbiddenError, requireActor, UnauthorizedError } from "@/lib/auth/session";
import { transitionSubscription } from "@/server/state-machine";
import {
  cancelMySubscription,
  pauseMySubscription,
  resumeMySubscription,
  type PortalDeps,
} from "./service";

const deps: PortalDeps = {
  transitionSubscription: (tx, { subscriptionId, to }, actor) =>
    transitionSubscription(tx, { id: subscriptionId, to, actor }).then(() => undefined),
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
  return guarded((actor) => db.transaction((tx) => pauseMySubscription(tx, actor, { id }, deps)));
}
export async function resumeMySubscriptionAction(id: string) {
  return guarded((actor) => db.transaction((tx) => resumeMySubscription(tx, actor, { id }, deps)));
}
export async function cancelMySubscriptionAction(id: string) {
  return guarded((actor) => db.transaction((tx) => cancelMySubscription(tx, actor, { id }, deps)));
}
