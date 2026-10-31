import { and, eq, inArray } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import {
  paymentTerms,
  plans,
  productTaxes,
  productVariants,
  products,
  quotationTemplateLines,
  quotationTemplates,
  subscriptionLines,
  subscriptions,
  taxes,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { assertRole, ServiceError } from "./errors";
import {
  paymentTermInput,
  planInput,
  productInput,
  taxInput,
  templateInput,
  type PaymentTermInput,
  type PlanInput,
  type ProductInput,
  type TaxInput,
  type TemplateInput,
} from "./schemas";

type Db = DB | Tx;

function inTx<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (db as DB).transaction(fn);
}

function requireFound<T>(row: T | undefined, what: string): T {
  if (!row) throw new ServiceError(`${what} not found`);
  return row;
}

/* ------------------------------ products ------------------------------ */

async function assertTaxesExist(tx: Tx, taxIds: string[]) {
  if (taxIds.length === 0) return;
  const found = await tx.select({ id: taxes.id }).from(taxes).where(inArray(taxes.id, taxIds));
  if (found.length !== new Set(taxIds).size) {
    throw new ServiceError("One or more taxes do not exist", { taxIds: ["Unknown tax"] });
  }
}

async function replaceProductTaxes(tx: Tx, productId: string, taxIds: string[]) {
  await tx.delete(productTaxes).where(eq(productTaxes.productId, productId));
  const unique = [...new Set(taxIds)];
  if (unique.length > 0) {
    await tx.insert(productTaxes).values(unique.map((taxId) => ({ productId, taxId })));
  }
}

export async function createProduct(
  db: Db,
  rawInput: ProductInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = productInput.parse(rawInput);
  return inTx(db, async (tx) => {
    await assertTaxesExist(tx, input.taxIds);
    const [row] = await tx
      .insert(products)
      .values({
        name: input.name,
        type: input.type,
        salesPrice: input.salesPrice,
        costPrice: input.costPrice,
        notes: input.notes ?? null,
      })
      .returning({ id: products.id });
    if (input.variants.length > 0) {
      await tx.insert(productVariants).values(
        input.variants.map((v) => ({
          productId: row.id,
          attribute: v.attribute,
          value: v.value,
          extraPrice: v.extraPrice,
        })),
      );
    }
    await replaceProductTaxes(tx, row.id, input.taxIds);
    return { id: row.id };
  });
}

export async function updateProduct(
  db: Db,
  id: string,
  rawInput: ProductInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = productInput.parse(rawInput);
  return inTx(db, async (tx) => {
    requireFound(
      (await tx.select({ id: products.id }).from(products).where(eq(products.id, id)))[0],
      "Product",
    );
    await assertTaxesExist(tx, input.taxIds);
    await tx
      .update(products)
      .set({
        name: input.name,
        type: input.type,
        salesPrice: input.salesPrice,
        costPrice: input.costPrice,
        notes: input.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    // Variant upsert: update the ones that kept an id, insert new, delete the rest.
    const existing = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, id));
    const existingIds = new Set(existing.map((v) => v.id));
    const keptIds = new Set<string>();
    for (const v of input.variants) {
      if (v.id) {
        if (!existingIds.has(v.id)) {
          throw new ServiceError("Variant does not belong to this product", {
            variants: ["Unknown variant"],
          });
        }
        keptIds.add(v.id);
      }
    }
    const removed = [...existingIds].filter((vid) => !keptIds.has(vid));
    if (removed.length > 0) {
      const inSubs = await tx
        .select({ id: subscriptionLines.id })
        .from(subscriptionLines)
        .where(inArray(subscriptionLines.variantId, removed))
        .limit(1);
      const inTemplates = await tx
        .select({ id: quotationTemplateLines.id })
        .from(quotationTemplateLines)
        .where(inArray(quotationTemplateLines.variantId, removed))
        .limit(1);
      if (inSubs.length > 0 || inTemplates.length > 0) {
        throw new ServiceError("A removed variant is still used by a subscription or template");
      }
      await tx.delete(productVariants).where(inArray(productVariants.id, removed));
    }
    for (const v of input.variants) {
      if (v.id) {
        await tx
          .update(productVariants)
          .set({ attribute: v.attribute, value: v.value, extraPrice: v.extraPrice })
          .where(eq(productVariants.id, v.id));
      } else {
        await tx.insert(productVariants).values({
          productId: id,
          attribute: v.attribute,
          value: v.value,
          extraPrice: v.extraPrice,
        });
      }
    }
    await replaceProductTaxes(tx, id, input.taxIds);
    return { id };
  });
}

/** Never hard-deletes: subscriptions reference products. */
export async function archiveProduct(db: Db, id: string, actor: Actor): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const rows = await db
    .update(products)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning({ id: products.id });
  requireFound(rows[0], "Product");
  return { id };
}

/* -------------------------------- plans -------------------------------- */

export async function createPlan(db: Db, rawInput: PlanInput, actor: Actor): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = planInput.parse(rawInput);
  const [row] = await db.insert(plans).values(input).returning({ id: plans.id });
  return { id: row.id };
}

export async function updatePlan(
  db: Db,
  id: string,
  rawInput: PlanInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = planInput.parse(rawInput);
  const rows = await db.update(plans).set(input).where(eq(plans.id, id)).returning({ id: plans.id });
  requireFound(rows[0], "Plan");
  return { id };
}

export async function archivePlan(db: Db, id: string, actor: Actor): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const rows = await db
    .update(plans)
    .set({ active: false })
    .where(eq(plans.id, id))
    .returning({ id: plans.id });
  requireFound(rows[0], "Plan");
  return { id };
}

/* -------------------------------- taxes -------------------------------- */

export async function createTax(db: Db, rawInput: TaxInput, actor: Actor): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = taxInput.parse(rawInput);
  const [row] = await db.insert(taxes).values(input).returning({ id: taxes.id });
  return { id: row.id };
}

export async function updateTax(
  db: Db,
  id: string,
  rawInput: TaxInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = taxInput.parse(rawInput);
  const rows = await db.update(taxes).set(input).where(eq(taxes.id, id)).returning({ id: taxes.id });
  requireFound(rows[0], "Tax");
  return { id };
}

export async function archiveTax(db: Db, id: string, actor: Actor): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const rows = await db
    .update(taxes)
    .set({ active: false })
    .where(eq(taxes.id, id))
    .returning({ id: taxes.id });
  requireFound(rows[0], "Tax");
  return { id };
}

/* ---------------------------- payment terms ---------------------------- */

export async function createPaymentTerm(
  db: Db,
  rawInput: PaymentTermInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = paymentTermInput.parse(rawInput);
  const [row] = await db.insert(paymentTerms).values(input).returning({ id: paymentTerms.id });
  return { id: row.id };
}

export async function updatePaymentTerm(
  db: Db,
  id: string,
  rawInput: PaymentTermInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = paymentTermInput.parse(rawInput);
  const rows = await db
    .update(paymentTerms)
    .set(input)
    .where(eq(paymentTerms.id, id))
    .returning({ id: paymentTerms.id });
  requireFound(rows[0], "Payment term");
  return { id };
}

/* ----------------------------- templates ----------------------------- */

async function assertTemplateRefs(tx: Tx, input: TemplateInput) {
  requireFound(
    (await tx.select({ id: plans.id }).from(plans).where(eq(plans.id, input.planId)))[0],
    "Plan",
  );
  requireFound(
    (
      await tx
        .select({ id: paymentTerms.id })
        .from(paymentTerms)
        .where(eq(paymentTerms.id, input.paymentTermId))
    )[0],
    "Payment term",
  );
  for (const [i, line] of input.lines.entries()) {
    requireFound(
      (await tx.select({ id: products.id }).from(products).where(eq(products.id, line.productId)))[0],
      "Product",
    );
    if (line.variantId) {
      const v = (
        await tx
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.id, line.variantId),
              eq(productVariants.productId, line.productId),
            ),
          )
      )[0];
      if (!v) {
        throw new ServiceError("Variant does not belong to the product", {
          [`lines.${i}.variantId`]: ["Unknown variant"],
        });
      }
    }
  }
}

function templateLineValues(templateId: string, input: TemplateInput) {
  return input.lines.map((l) => ({
    templateId,
    productId: l.productId,
    variantId: l.variantId,
    quantity: l.quantity,
  }));
}

export async function createTemplate(
  db: Db,
  rawInput: TemplateInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = templateInput.parse(rawInput);
  return inTx(db, async (tx) => {
    await assertTemplateRefs(tx, input);
    const [row] = await tx
      .insert(quotationTemplates)
      .values({
        name: input.name,
        validityDays: input.validityDays,
        planId: input.planId,
        paymentTermId: input.paymentTermId,
        notes: input.notes ?? null,
      })
      .returning({ id: quotationTemplates.id });
    await tx.insert(quotationTemplateLines).values(templateLineValues(row.id, input));
    return { id: row.id };
  });
}

export async function updateTemplate(
  db: Db,
  id: string,
  rawInput: TemplateInput,
  actor: Actor,
): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const input = templateInput.parse(rawInput);
  return inTx(db, async (tx) => {
    await assertTemplateRefs(tx, input);
    const rows = await tx
      .update(quotationTemplates)
      .set({
        name: input.name,
        validityDays: input.validityDays,
        planId: input.planId,
        paymentTermId: input.paymentTermId,
        notes: input.notes ?? null,
      })
      .where(eq(quotationTemplates.id, id))
      .returning({ id: quotationTemplates.id });
    requireFound(rows[0], "Template");
    await tx.delete(quotationTemplateLines).where(eq(quotationTemplateLines.templateId, id));
    await tx.insert(quotationTemplateLines).values(templateLineValues(id, input));
    return { id };
  });
}

/** Templates have no `active` flag, so deletion is only allowed while no subscription used it. */
export async function deleteTemplate(db: Db, id: string, actor: Actor): Promise<{ id: string }> {
  assertRole(actor, "admin");
  const used = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.templateId, id))
    .limit(1);
  if (used.length > 0) {
    throw new ServiceError("Template is used by subscriptions and cannot be deleted");
  }
  const rows = await db
    .delete(quotationTemplates)
    .where(eq(quotationTemplates.id, id))
    .returning({ id: quotationTemplates.id });
  requireFound(rows[0], "Template");
  return { id };
}

export { isPlanAvailable } from "./plan-availability";
