"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { db } from "@/db/client";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { requireActor } from "@/lib/auth/session";
import { InvalidTransitionError } from "@/server/state-machine";
import {
  applyAction,
  createFromTemplate,
  createSubscription,
  renewSubscription,
  updateSubscription,
} from "./service";
import type { ApplyActionInput, FromTemplateInput, SubscriptionInput } from "./schemas";

function toFailure(err: unknown): ActionResult<never> {
  if (err instanceof ZodError) return fromZodError(err);
  if (err instanceof InvalidTransitionError) return fail(err.reason);
  if (err instanceof Error && err.name === "SubscriptionError") return fail(err.message);
  if (err instanceof Error && err.name === "ForbiddenError") return fail("Forbidden");
  throw err;
}

function revalidate(id?: string) {
  revalidatePath("/subscriptions");
  if (id) revalidatePath(`/subscriptions/${id}`);
}

export async function createSubscriptionAction(
  input: SubscriptionInput,
): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const actor = await requireActor("admin", "staff");
    const sub = await db.transaction((tx) => createSubscription(tx, input, actor));
    revalidate();
    return ok({ id: sub.id, number: sub.number });
  } catch (err) {
    return toFailure(err);
  }
}

export async function createFromTemplateAction(
  input: FromTemplateInput,
): Promise<ActionResult<{ id: string; number: string }>> {
  try {
    const actor = await requireActor("admin", "staff");
    const sub = await db.transaction((tx) => createFromTemplate(tx, input, actor));
    revalidate();
    return ok({ id: sub.id, number: sub.number });
  } catch (err) {
    return toFailure(err);
  }
}

export async function updateSubscriptionAction(
  id: string,
  input: SubscriptionInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor("admin", "staff");
    await db.transaction((tx) => updateSubscription(tx, id, input, actor));
    revalidate(id);
    return ok({ id });
  } catch (err) {
    return toFailure(err);
  }
}

export async function applySubscriptionAction(
  input: ApplyActionInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor("admin", "staff");
    await db.transaction((tx) => applyAction(tx, input, actor));
    revalidate(input.id);
    return ok({ id: input.id });
  } catch (err) {
    return toFailure(err);
  }
}

export async function renewSubscriptionAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireActor("admin", "staff");
    await db.transaction((tx) => renewSubscription(tx, { id }, actor));
    revalidate(id);
    return ok({ id });
  } catch (err) {
    return toFailure(err);
  }
}
