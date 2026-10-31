import { and, eq, ne, sql } from "drizzle-orm";
import { customers, invoices, plans, subscriptions, type Subscription } from "@/db/schema";
import { todayIST } from "@/lib/dates";
import { PaymentError, recordPayment } from "@/features/payments/service";
import { InvalidTransitionError, transitionSubscription } from "@/server/state-machine";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import type { Actor } from "@/lib/auth/session";
import { portalSubscriptionActions } from "./queries";
import {
  acceptQuotationInput,
  payMyInvoiceInput,
  subscriptionIdSchema,
  updateMyContactInput,
} from "./schemas";
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

export async function payMyInvoice(db: Db, actor: Actor, input: unknown): Promise<ActionResult<null>> {
  const parsed = payMyInvoiceInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const customerId = await resolveCustomerId(db, actor);
  if (!customerId) return fail("Not found");

  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, parsed.data.invoiceId), eq(invoices.customerId, customerId)))
    .limit(1);
  if (!inv) return fail("Not found");
  if (inv.status !== "confirmed") return fail("This invoice cannot be paid right now");
  const balance = inv.total - inv.amountPaid;
  if (balance <= 0) return fail("Nothing is due on this invoice");

  try {
    // Mock gateway: the full balance is treated as paid immediately.
    await recordPayment(
      db,
      {
        invoiceId: inv.id,
        method: parsed.data.method,
        amount: balance,
        paidOn: todayIST(),
        note: "Paid via customer portal",
      },
      actor,
    );
  } catch (err) {
    if (err instanceof PaymentError || err instanceof InvalidTransitionError) return fail(err.message);
    throw err;
  }
  return ok(null);
}

export async function acceptMyQuotation(db: Db, actor: Actor, input: unknown): Promise<ActionResult<null>> {
  const parsed = acceptQuotationInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const customerId = await resolveCustomerId(db, actor);
  if (!customerId) return fail("Not found");

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, parsed.data.subscriptionId), eq(subscriptions.customerId, customerId)))
    .limit(1);
  if (!sub) return fail("Not found");
  if (sub.status !== "quotation") return fail("This quotation cannot be accepted");
  if (sub.quotationValidUntil && sub.quotationValidUntil < todayIST()) {
    return fail("This quotation has expired");
  }

  try {
    await transitionSubscription(db, { id: sub.id, to: "confirmed", actor });
  } catch (err) {
    if (err instanceof InvalidTransitionError) return fail(err.message);
    throw err;
  }
  return ok(null);
}

export async function updateMyContact(db: Db, actor: Actor, input: unknown): Promise<ActionResult<null>> {
  const parsed = updateMyContactInput.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  const customerId = await resolveCustomerId(db, actor);
  if (!customerId) return fail("Not found");

  const v = parsed.data;
  const [clash] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(sql`lower(${customers.email}) = ${v.email}`, ne(customers.id, customerId)))
    .limit(1);
  if (clash) {
    const msg = "A customer with this email already exists";
    return fail(msg, { email: [msg] });
  }

  await db
    .update(customers)
    .set({ name: v.name, email: v.email, phone: v.phone || null, address: v.address || null })
    .where(eq(customers.id, customerId));
  return ok(null);
}
