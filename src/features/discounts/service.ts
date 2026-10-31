import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { discountProducts, discountRedemptions, discounts } from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { logActivity } from "@/server/activity-log";
import { discountInput, type DiscountInput, type DiscountInputParsed } from "./schemas";

type Executor = DB | Tx;

export class DiscountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscountError";
  }
}

function assertAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new DiscountError("Forbidden");
}

function toRow(v: DiscountInputParsed) {
  return {
    name: v.name,
    kind: v.kind,
    value: v.value,
    scope: v.scope,
    minAmount: v.minAmount,
    minQty: v.minQty,
    startsOn: v.startsOn,
    endsOn: v.endsOn,
    usageLimit: v.usageLimit,
    active: v.active,
  };
}

async function setProducts(tx: Executor, discountId: string, v: DiscountInputParsed) {
  await tx.delete(discountProducts).where(eq(discountProducts.discountId, discountId));
  if (v.scope === "products" && v.productIds.length) {
    await tx
      .insert(discountProducts)
      .values([...new Set(v.productIds)].map((productId) => ({ discountId, productId })));
  }
}

export async function createDiscount(tx: Executor, input: DiscountInput, actor: Actor) {
  assertAdmin(actor);
  const v = discountInput.parse(input);
  const [row] = await tx.insert(discounts).values(toRow(v)).returning();
  await setProducts(tx, row.id, v);
  await logActivity(tx, {
    entityType: "discount",
    entityId: row.id,
    action: "created",
    actorId: actor.id,
  });
  return row;
}

export async function updateDiscount(tx: Executor, id: string, input: DiscountInput, actor: Actor) {
  assertAdmin(actor);
  const v = discountInput.parse(input);
  const [row] = await tx.update(discounts).set(toRow(v)).where(eq(discounts.id, id)).returning();
  if (!row) throw new DiscountError("Discount not found");
  await setProducts(tx, id, v);
  await logActivity(tx, { entityType: "discount", entityId: id, action: "updated", actorId: actor.id });
  return row;
}

/** Archiving = deactivating; redemptions keep pointing at the row. */
export async function archiveDiscount(tx: Executor, id: string, actor: Actor) {
  assertAdmin(actor);
  const [row] = await tx.update(discounts).set({ active: false }).where(eq(discounts.id, id)).returning();
  if (!row) throw new DiscountError("Discount not found");
  await logActivity(tx, { entityType: "discount", entityId: id, action: "archived", actorId: actor.id });
  return row;
}

/**
 * Records redemptions for an invoice and bumps `used_count`, honouring the usage limit atomically.
 * Returns ids of discounts whose limit was hit (their redemption is not kept); billing reprices without them.
 * Already-redeemed pairs are ignored (no double count).
 */
export async function redeemDiscounts(
  tx: Executor,
  invoiceId: string,
  applied: { discountId: string; amount: number }[],
): Promise<string[]> {
  const failed: string[] = [];
  for (const a of applied) {
    const inserted = await tx
      .insert(discountRedemptions)
      .values({ discountId: a.discountId, invoiceId, amount: a.amount })
      .onConflictDoNothing()
      .returning({ id: discountRedemptions.id });
    if (inserted.length === 0) continue;

    const bumped = await tx
      .update(discounts)
      .set({ usedCount: sql`${discounts.usedCount} + 1` })
      .where(
        and(
          eq(discounts.id, a.discountId),
          or(isNull(discounts.usageLimit), lt(discounts.usedCount, discounts.usageLimit)),
        ),
      )
      .returning({ id: discounts.id });
    if (bumped.length === 0) {
      await tx.delete(discountRedemptions).where(eq(discountRedemptions.id, inserted[0].id));
      failed.push(a.discountId);
    }
  }
  return failed;
}
