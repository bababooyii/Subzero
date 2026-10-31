"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db/client";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireActor } from "@/lib/auth/session";
import { archiveDiscount, createDiscount, updateDiscount } from "./service";
import type { DiscountInput } from "./schemas";

function toFailure(err: unknown): ActionResult<never> {
  if (err instanceof ZodError) return fromZodError(err);
  if (err instanceof Error && err.name === "DiscountError") return fail(err.message);
  if (err instanceof Error && err.name === "ForbiddenError") return fail("Forbidden");
  throw err;
}

export async function createDiscountAction(input: DiscountInput): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor("admin");
    const row = await db.transaction((tx) => createDiscount(tx, input, actor));
    revalidatePath("/catalog/discounts");
    return ok({ id: row.id });
  } catch (err) {
    return toFailure(err);
  }
}

export async function updateDiscountAction(id: string, input: DiscountInput): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor("admin");
    await db.transaction((tx) => updateDiscount(tx, id, input, actor));
    revalidatePath("/catalog/discounts");
    return ok({ id });
  } catch (err) {
    return toFailure(err);
  }
}

export async function archiveDiscountAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor("admin");
    await db.transaction((tx) => archiveDiscount(tx, id, actor));
    revalidatePath("/catalog/discounts");
    return ok({ id });
  } catch (err) {
    return toFailure(err);
  }
}
