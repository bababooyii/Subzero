import { and, eq } from "drizzle-orm";
import { plans, subscriptions, type Subscription } from "@/db/schema";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import type { Actor } from "@/lib/auth/session";
import { portalSubscriptionActions } from "./queries";
import { subscriptionIdSchema } from "./schemas";
import { resolveCustomerId, type Db } from "./scope";

type Target = Extract<Subscription["status"], "paused" | "active" | "closed">;

/**
 * Status changes are not made here (CI forbids it outside the state machine); callers inject
 * the state machine's `transitionSubscription`, adapted to this shape.
 */
export type PortalDeps = {
  transitionSubscription: (
    db: Db,
    input: { subscriptionId: string; to: Target },
    actor: Actor,
  ) => Promise<void>;
};

type Action = "pause" | "resume" | "cancel";

const TARGET: Record<Action, Target> = { pause: "paused", resume: "active", cancel: "closed" };
const PAST: Record<Action, string> = { pause: "paused", resume: "resumed", cancel: "cancelled" };
const FLAG: Record<Action, "canPause" | "canResume" | "canCancel"> = {
  pause: "canPause",
  resume: "canResume",
  cancel: "canCancel",
};

async function run(
  db: Db,
  actor: Actor,
  input: unknown,
  action: Action,
  deps: PortalDeps,
): Promise<ActionResult<null>> {
  const parsed = subscriptionIdSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const customerId = await resolveCustomerId(db, actor);
  if (!customerId) return fail("Not found");

  // Scoped lookup: someone else's subscription is indistinguishable from a missing one.
  const [row] = await db
    .select({ sub: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.id, parsed.data.id), eq(subscriptions.customerId, customerId)))
    .limit(1);
  if (!row) return fail("Not found");

  const allowed = portalSubscriptionActions(row.sub.status, row.plan);
  if (!allowed[FLAG[action]]) return fail(`This subscription cannot be ${PAST[action]} right now`);

  await deps.transitionSubscription(db, { subscriptionId: row.sub.id, to: TARGET[action] }, actor);
  return ok(null);
}

export const pauseMySubscription = (db: Db, actor: Actor, input: unknown, deps: PortalDeps) =>
  run(db, actor, input, "pause", deps);
export const resumeMySubscription = (db: Db, actor: Actor, input: unknown, deps: PortalDeps) =>
  run(db, actor, input, "resume", deps);
export const cancelMySubscription = (db: Db, actor: Actor, input: unknown, deps: PortalDeps) =>
  run(db, actor, input, "cancel", deps);
