"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db/client";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireActor } from "@/lib/auth/session";
import { InvalidTransitionError } from "@/server/state-machine";
import { deletePayment, recordPayment } from "./service";
import type { PaymentInput } from "./schemas";

function toFailure(err: unknown): ActionResult<never> {
  if (err instanceof ZodError) return fromZodError(err);
  if (err instanceof InvalidTransitionError) return fail(err.reason);
  if (err instanceof Error && err.name === "PaymentError") return fail(err.message);
  if (err instanceof Error && err.name === "ForbiddenError") return fail("Forbidden");
  throw err;
}

export async function recordPaymentAction(input: PaymentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor("admin", "staff");
    const payment = await db.transaction((tx) => recordPayment(tx, input, actor));
    revalidatePath("/payments");
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${payment.invoiceId}`);
    return ok({ id: payment.id });
  } catch (err) {
    return toFailure(err);
  }
}

export async function deletePaymentAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor("admin");
    const payment = await db.transaction((tx) => deletePayment(tx, id, actor));
    revalidatePath("/payments");
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${payment.invoiceId}`);
    return ok({ id });
  } catch (err) {
    return toFailure(err);
  }
}
