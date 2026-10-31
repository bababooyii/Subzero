"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { billingDeps } from "@/features/billing/deps";
import { bulkConfirmInvoicesAction } from "@/features/invoices/actions";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { ForbiddenError, requireActor, UnauthorizedError } from "@/lib/auth/session";
import { todayIST } from "@/lib/dates";
import { runBilling } from "@/server/billing";

export type ApproveBillingResult = {
  /** Invoices the run created, in creation order (per subscription, oldest period first). */
  invoices: { id: string; number: string; subscriptionId: string }[];
  /** Created, but the confirm step failed: they stay as drafts on the Invoices page. */
  unconfirmed: number;
  /** Due subscriptions the run did not bill (already billed, no lines, error). */
  skippedSubscriptionIds: string[];
};

const idsInput = z.array(z.string().uuid()).min(1).max(5000);
const CONFIRM_CHUNK = 200; // the invoice bulk actions accept at most 200 ids

function reasonText(reason: string) {
  return reason === "not_due" ? "It is no longer due to bill." : reason === "no_lines" ? "It has no lines to bill." : reason;
}

/**
 * Billing-run approval (per card or "Confirm all"): bills just these subscriptions through the real billing run
 * (`runBilling` with `subscriptionIds`, the same code `runBillingAction` uses for everything that is due), then confirms
 * the invoices it created through `bulkConfirmInvoicesAction`. Subscriptions skipped in the deck are simply not passed,
 * so they stay due. `runBillingAction()` has no way to leave some subscriptions out, hence this wrapper.
 */
export async function approveBillingAction(subscriptionIds: string[]): Promise<ActionResult<ApproveBillingResult>> {
  const parsed = idsInput.safeParse(subscriptionIds);
  if (!parsed.success) return fail("Nothing to approve");
  try {
    const actor = await requireActor("admin", "staff");
    const run = await runBilling(db, { on: todayIST(), actor, subscriptionIds: parsed.data }, billingDeps);
    if (run.created.length === 0) {
      const why = run.skipped[0] ? ` ${reasonText(run.skipped[0].reason)}` : "";
      return fail(`No invoice was created.${why}`);
    }

    const confirmedIds = new Set<string>();
    for (let i = 0; i < run.created.length; i += CONFIRM_CHUNK) {
      const chunk = run.created.slice(i, i + CONFIRM_CHUNK).map((c) => c.invoiceId);
      const res = await bulkConfirmInvoicesAction(chunk);
      if (res.ok) res.data.done.forEach((id) => confirmedIds.add(id));
    }
    for (const p of ["/billing", "/invoices", "/subscriptions", "/dashboard"]) revalidatePath(p);

    const billed = new Set(run.created.map((c) => c.subscriptionId));
    return ok({
      invoices: run.created.map((c) => ({ id: c.invoiceId, number: c.number, subscriptionId: c.subscriptionId })),
      unconfirmed: run.created.filter((c) => !confirmedIds.has(c.invoiceId)).length,
      skippedSubscriptionIds: parsed.data.filter((id) => !billed.has(id)),
    });
  } catch (err) {
    if (err instanceof ForbiddenError) return fail("Forbidden");
    if (err instanceof UnauthorizedError) return fail("Not signed in");
    console.error(err);
    return fail("Something went wrong");
  }
}
