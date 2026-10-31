"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { fail, ok } from "@/lib/action-result";
import { ForbiddenError, requireActor, UnauthorizedError } from "@/lib/auth/session";
import { todayIST } from "@/lib/dates";
import { previewBilling, runBilling } from "@/server/billing";
import { billingDeps } from "./deps";

function toFailure(err: unknown) {
  if (err instanceof ForbiddenError) return fail("Forbidden");
  if (err instanceof UnauthorizedError) return fail("Not signed in");
  throw err;
}

export async function previewBillingAction() {
  try {
    await requireActor("admin", "staff");
    return ok(await previewBilling(db, todayIST(), billingDeps));
  } catch (err) {
    return toFailure(err);
  }
}

export async function runBillingAction() {
  try {
    const actor = await requireActor("admin", "staff");
    const result = await runBilling(db, { on: todayIST(), actor }, billingDeps);
    for (const p of ["/billing", "/invoices", "/subscriptions", "/dashboard"]) revalidatePath(p);
    return ok(result);
  } catch (err) {
    return toFailure(err);
  }
}
