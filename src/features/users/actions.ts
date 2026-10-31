"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { customers, user } from "@/db/schema";
import { fail, fromZodError, ok, type ActionResult } from "@/lib/action-result";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/auth/session";
import { listUsers, type ListUsersParams, type UserRow } from "./queries";
import type { Paged } from "@/lib/pagination";

const createStaffSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export async function createStaffUser(
  input: CreateStaffInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("admin");
  } catch {
    return fail("Forbidden");
  }
  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) return fromZodError(parsed.error);

  try {
    // Password rules are enforced by the auth before-hook.
    const res = await auth.api.signUpEmail({ body: parsed.data });
    await db.update(user).set({ role: "staff" }).where(eq(user.id, res.user.id));
    await db.delete(customers).where(eq(customers.userId, res.user.id));
    return ok({ id: res.user.id });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not create user");
  }
}

export async function listUsersAction(
  params: ListUsersParams = {},
): Promise<ActionResult<Paged<UserRow>>> {
  try {
    await requireRole("admin");
  } catch {
    return fail("Forbidden");
  }
  try {
    return ok(await listUsers(db, params));
  } catch (err) {
    console.error(err);
    return fail("Something went wrong");
  }
}
