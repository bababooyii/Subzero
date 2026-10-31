import { eq } from "drizzle-orm";
import { billingRuns, subscriptions } from "@/db/schema";
import { addInterval } from "@/lib/dates";
import { buildInvoice, type BuiltInvoice } from "./build-invoice";
import { insertInvoice } from "./insert-invoice";
import { loadContext, type SubscriptionContext } from "./load";
import type { BillingActor, BillingDeps, DB, Tx } from "./types";
import { findDueSubscriptions } from "./due";

export const MAX_PERIODS_PER_RUN = 24;

export type BillingRunResult = {
  runId: string;
  created: { invoiceId: string; number: string; subscriptionId: string }[];
  skipped: { subscriptionId: string; reason: string }[];
};

/** Thrown inside a period's savepoint when some discounts hit their usage limit. */
class RedemptionFailed extends Error {
  constructor(readonly failedIds: string[]) {
    super("discount usage limit reached");
  }
}

export async function buildForPeriod(
  db: DB | Tx,
  ctx: SubscriptionContext,
  periodStart: string,
  on: string,
  deps: Pick<BillingDeps, "listApplicableDiscounts">,
  excluded: string[] = [],
): Promise<BuiltInvoice> {
  const all = await deps.listApplicableDiscounts(db, {
    productIds: [...new Set(ctx.lines.map((l) => l.productId))],
    on,
  });
  return buildInvoice({
    subscription: ctx.subscription,
    customer: ctx.customer,
    plan: ctx.plan,
    lines: ctx.lines,
    taxesByProduct: ctx.taxesByProduct,
    discounts: all.filter((d) => !excluded.includes(d.id)),
    periodStart,
    termsDueDays: ctx.termsDueDays,
    on,
  });
}

/** Builds, inserts and redeems one period inside the caller's (savepoint) transaction. */
async function billPeriod(
  tx: Tx,
  ctx: SubscriptionContext,
  periodStart: string,
  on: string,
  deps: BillingDeps,
  excluded: string[],
): Promise<{ invoiceId: string; number: string } | null> {
  const built = await buildForPeriod(tx, ctx, periodStart, on, deps, excluded);
  const inserted = await insertInvoice(tx, built);
  if (!inserted) return null;
  if (built.applied.length > 0) {
    const failed = await deps.redeemDiscounts(
      tx,
      inserted.id,
      built.applied.map((a) => ({ discountId: a.discountId, amount: a.amount })),
    );
    if (failed.length > 0) throw new RedemptionFailed(failed);
  }
  return { invoiceId: inserted.id, number: inserted.number };
}

async function billSubscription(
  db: DB,
  subscriptionId: string,
  on: string,
  deps: BillingDeps,
): Promise<{ created: BillingRunResult["created"]; skipped: BillingRunResult["skipped"] }> {
  return db.transaction(async (tx) => {
    // Lock first so a concurrent run waits, then sees the advanced date.
    const [locked] = await tx
      .select({ st: subscriptions.status, next: subscriptions.nextInvoiceDate })
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .for("update");
    if (!locked || locked.st !== "active" || !locked.next || locked.next > on) {
      return { created: [], skipped: [{ subscriptionId, reason: "not_due" }] };
    }

    const ctx = await loadContext(tx, subscriptionId);
    if (!ctx) return { created: [], skipped: [{ subscriptionId, reason: "not_found" }] };
    if (ctx.lines.length === 0) {
      return { created: [], skipped: [{ subscriptionId, reason: "no_lines" }] };
    }

    const created: BillingRunResult["created"] = [];
    let next: string | null = locked.next;
    let periods = 0;

    while (next && next <= on && periods < MAX_PERIODS_PER_RUN) {
      const periodStart: string = next;

      // Savepoint per period: a failed redemption rolls back just this period.
      const attempt = (excluded: string[]) =>
        tx.transaction((sp) => billPeriod(sp, ctx, periodStart, on, deps, excluded));
      let result: { invoiceId: string; number: string } | null;
      try {
        result = await attempt([]);
      } catch (err) {
        if (!(err instanceof RedemptionFailed)) throw err;
        result = await attempt(err.failedIds); // retry once without the failed discounts
      }
      if (result) created.push({ ...result, subscriptionId });

      periods += 1;
      next = addInterval(periodStart, ctx.plan.interval, ctx.plan.intervalCount);
      await tx
        .update(subscriptions)
        .set({ nextInvoiceDate: next, updatedAt: new Date() })
        .where(eq(subscriptions.id, subscriptionId));

      if (ctx.subscription.expiryDate && next > ctx.subscription.expiryDate) {
        if (ctx.plan.autoClose) {
          await deps.closeSubscription(tx, subscriptionId);
        } else {
          await tx
            .update(subscriptions)
            .set({ nextInvoiceDate: null })
            .where(eq(subscriptions.id, subscriptionId));
        }
        next = null;
      }
    }
    return { created, skipped: [] };
  });
}

export async function runBilling(
  db: DB,
  input: { on: string; actor: BillingActor; subscriptionIds?: string[] },
  deps: BillingDeps,
): Promise<BillingRunResult> {
  const { on, actor, subscriptionIds } = input;
  const dueIds = await findDueSubscriptions(db, on, subscriptionIds);

  const created: BillingRunResult["created"] = [];
  const skipped: BillingRunResult["skipped"] = [];
  for (const id of dueIds) {
    try {
      const r = await billSubscription(db, id, on, deps);
      created.push(...r.created);
      skipped.push(...r.skipped);
    } catch (err) {
      skipped.push({ subscriptionId: id, reason: err instanceof Error ? err.message : "error" });
    }
  }

  const [run] = await db
    .insert(billingRuns)
    .values({
      runDate: on,
      createdCount: created.length,
      skippedCount: skipped.length,
      startedBy: actor.id,
    })
    .returning({ id: billingRuns.id });

  return { runId: run.id, created, skipped };
}
