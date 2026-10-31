import { and, asc, desc, eq, ilike, inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import {
  paymentTerms,
  plans,
  productTaxes,
  productVariants,
  products,
  quotationTemplateLines,
  quotationTemplates,
  taxes,
} from "@/db/schema";
import { toLimitOffset, type ListParams, type Paged } from "@/lib/pagination";
import { ServiceError } from "./errors";
import { unitPriceWithVariant, variantLabel } from "./plan-availability";

type Db = DB | Tx;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Escape LIKE wildcards so user input is matched literally. */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function orderBy(col: AnyColumn | SQL, dir: ListParams["dir"]) {
  return dir === "desc" ? desc(col) : asc(col);
}

/* ------------------------------ products ------------------------------ */

export type ProductRow = {
  id: string;
  name: string;
  type: "service" | "goods";
  salesPrice: number;
  costPrice: number;
  variantCount: number;
  active: boolean;
};

export async function listProducts(
  db: Db,
  params: ListParams & { type?: "service" | "goods"; active?: boolean } = {},
): Promise<Paged<ProductRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const conds: SQL[] = [];
  if (params.q?.trim()) conds.push(ilike(products.name, containsPattern(params.q.trim())));
  if (params.type) conds.push(eq(products.type, params.type));
  if (params.active !== undefined) conds.push(eq(products.active, params.active));
  const where = conds.length ? and(...conds) : undefined;

  const sortCols = {
    name: products.name,
    salesPrice: products.salesPrice,
    createdAt: products.createdAt,
  } as const;
  const sortCol = sortCols[(params.sort as keyof typeof sortCols) ?? "name"] ?? products.name;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      type: products.type,
      salesPrice: products.salesPrice,
      costPrice: products.costPrice,
      active: products.active,
      variantCount: sql<number>`(select count(*)::int from ${productVariants} where ${productVariants.productId} = "products"."id")`,
    })
    .from(products)
    .where(where)
    .orderBy(orderBy(sortCol, params.dir), asc(products.id))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(where);
  return { rows, total, page, pageSize };
}

export async function getProduct(db: Db, id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) return null;
  const variants = await db
    .select({
      id: productVariants.id,
      attribute: productVariants.attribute,
      value: productVariants.value,
      extraPrice: productVariants.extraPrice,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(asc(productVariants.attribute), asc(productVariants.value));
  const productTaxRows = await db
    .select({ id: taxes.id, name: taxes.name, rateBps: taxes.rateBps })
    .from(productTaxes)
    .innerJoin(taxes, eq(productTaxes.taxId, taxes.id))
    .where(eq(productTaxes.productId, id))
    .orderBy(asc(taxes.name));
  return {
    id: product.id,
    name: product.name,
    type: product.type,
    salesPrice: product.salesPrice,
    costPrice: product.costPrice,
    notes: product.notes,
    active: product.active,
    createdAt: isoDate(product.createdAt),
    variants,
    taxes: productTaxRows,
  };
}

export type ProductOption = {
  id: string;
  name: string;
  salesPrice: number;
  taxRatesBps: number[];
  variants: { id: string; label: string; extraPrice: number }[];
};

/** Active products for pickers (3 queries total, grouped in memory). */
export async function productOptions(db: Db): Promise<ProductOption[]> {
  const prods = await db
    .select({ id: products.id, name: products.name, salesPrice: products.salesPrice })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.name), asc(products.id));
  if (prods.length === 0) return [];
  const ids = prods.map((p) => p.id);
  const taxRows = await db
    .select({ productId: productTaxes.productId, rateBps: taxes.rateBps })
    .from(productTaxes)
    .innerJoin(taxes, eq(productTaxes.taxId, taxes.id))
    .where(and(inArray(productTaxes.productId, ids), eq(taxes.active, true)));
  const variantRows = await db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, ids))
    .orderBy(asc(productVariants.attribute), asc(productVariants.value));
  return prods.map((p) => ({
    ...p,
    taxRatesBps: taxRows.filter((t) => t.productId === p.id).map((t) => t.rateBps),
    variants: variantRows
      .filter((v) => v.productId === p.id)
      .map((v) => ({
        id: v.id,
        label: variantLabel(v.attribute, v.value),
        extraPrice: v.extraPrice,
      })),
  }));
}

export type LineUnitPrice = {
  unitPrice: number;
  taxRatesBps: number[];
  description: string;
  variantLabel: string | null;
};

/**
 * Price + tax snapshot inputs for one subscription/invoice line.
 * Used by billing (lane A) and subscriptions (lane C): keep the name and shape.
 */
export async function lineUnitPrice(
  db: Db,
  productId: string,
  variantId: string | null,
): Promise<LineUnitPrice> {
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) throw new ServiceError("Product not found");
  let extra = 0;
  let label: string | null = null;
  if (variantId) {
    const [variant] = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
    if (!variant) throw new ServiceError("Variant not found for this product");
    extra = variant.extraPrice;
    label = variantLabel(variant.attribute, variant.value);
  }
  const taxRows = await db
    .select({ rateBps: taxes.rateBps })
    .from(productTaxes)
    .innerJoin(taxes, eq(productTaxes.taxId, taxes.id))
    .where(and(eq(productTaxes.productId, productId), eq(taxes.active, true)));
  return {
    unitPrice: unitPriceWithVariant(product.salesPrice, extra),
    taxRatesBps: taxRows.map((t) => t.rateBps),
    description: product.name,
    variantLabel: label,
  };
}

/* -------------------------------- plans -------------------------------- */

export type PlanRow = {
  id: string;
  name: string;
  price: number;
  interval: "daily" | "weekly" | "monthly" | "yearly";
  intervalCount: number;
  minQty: number;
  availableFrom: string | null;
  availableTo: string | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  active: boolean;
};

export async function listPlans(
  db: Db,
  params: ListParams & { active?: boolean } = {},
): Promise<Paged<PlanRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const conds: SQL[] = [];
  if (params.q?.trim()) conds.push(ilike(plans.name, containsPattern(params.q.trim())));
  if (params.active !== undefined) conds.push(eq(plans.active, params.active));
  const where = conds.length ? and(...conds) : undefined;
  const sortCols = { name: plans.name, price: plans.price, availableFrom: plans.availableFrom } as const;
  const sortCol = sortCols[(params.sort as keyof typeof sortCols) ?? "name"] ?? plans.name;
  const rows = await db
    .select()
    .from(plans)
    .where(where)
    .orderBy(orderBy(sortCol, params.dir), asc(plans.id))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(plans)
    .where(where);
  return { rows, total, page, pageSize };
}

export async function getPlan(db: Db, id: string): Promise<PlanRow | null> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, id));
  return plan ?? null;
}

/* ------------------------ taxes and payment terms ------------------------ */

export async function listTaxes(db: Db) {
  return db
    .select({ id: taxes.id, name: taxes.name, rateBps: taxes.rateBps, active: taxes.active })
    .from(taxes)
    .orderBy(asc(taxes.name), asc(taxes.id));
}

export async function listPaymentTerms(db: Db) {
  return db
    .select({ id: paymentTerms.id, name: paymentTerms.name, dueDays: paymentTerms.dueDays })
    .from(paymentTerms)
    .orderBy(asc(paymentTerms.dueDays), asc(paymentTerms.name));
}

/* ----------------------------- templates ----------------------------- */

export type TemplateRow = {
  id: string;
  name: string;
  validityDays: number;
  planId: string | null;
  planName: string | null;
  paymentTermId: string | null;
  paymentTermName: string | null;
  lineCount: number;
};

export async function listTemplates(db: Db, params: ListParams = {}): Promise<Paged<TemplateRow>> {
  const { limit, offset, page, pageSize } = toLimitOffset(params);
  const where = params.q?.trim()
    ? ilike(quotationTemplates.name, containsPattern(params.q.trim()))
    : undefined;
  const sortCols = { name: quotationTemplates.name, validityDays: quotationTemplates.validityDays } as const;
  const sortCol =
    sortCols[(params.sort as keyof typeof sortCols) ?? "name"] ?? quotationTemplates.name;
  const rows = await db
    .select({
      id: quotationTemplates.id,
      name: quotationTemplates.name,
      validityDays: quotationTemplates.validityDays,
      planId: quotationTemplates.planId,
      planName: plans.name,
      paymentTermId: quotationTemplates.paymentTermId,
      paymentTermName: paymentTerms.name,
      lineCount: sql<number>`(select count(*)::int from ${quotationTemplateLines} where ${quotationTemplateLines.templateId} = "quotation_templates"."id")`,
    })
    .from(quotationTemplates)
    .leftJoin(plans, eq(quotationTemplates.planId, plans.id))
    .leftJoin(paymentTerms, eq(quotationTemplates.paymentTermId, paymentTerms.id))
    .where(where)
    .orderBy(orderBy(sortCol, params.dir), asc(quotationTemplates.id))
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(quotationTemplates)
    .where(where);
  return { rows, total, page, pageSize };
}

export async function getTemplate(db: Db, id: string) {
  const [template] = await db
    .select()
    .from(quotationTemplates)
    .where(eq(quotationTemplates.id, id));
  if (!template) return null;
  const plan = template.planId ? await getPlan(db, template.planId) : null;
  const [paymentTerm] = template.paymentTermId
    ? await db.select().from(paymentTerms).where(eq(paymentTerms.id, template.paymentTermId))
    : [];
  const lineRows = await db
    .select({
      id: quotationTemplateLines.id,
      productId: quotationTemplateLines.productId,
      variantId: quotationTemplateLines.variantId,
      quantity: quotationTemplateLines.quantity,
      productName: products.name,
      salesPrice: products.salesPrice,
      attribute: productVariants.attribute,
      value: productVariants.value,
      extraPrice: productVariants.extraPrice,
    })
    .from(quotationTemplateLines)
    .innerJoin(products, eq(quotationTemplateLines.productId, products.id))
    .leftJoin(productVariants, eq(quotationTemplateLines.variantId, productVariants.id))
    .where(eq(quotationTemplateLines.templateId, id))
    .orderBy(asc(quotationTemplateLines.id));
  return {
    id: template.id,
    name: template.name,
    validityDays: template.validityDays,
    planId: template.planId,
    paymentTermId: template.paymentTermId,
    notes: template.notes,
    plan,
    paymentTerm: paymentTerm ?? null,
    lines: lineRows.map((l) => ({
      id: l.id,
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      productName: l.productName,
      variantLabel: l.attribute && l.value ? variantLabel(l.attribute, l.value) : null,
      unitPrice: unitPriceWithVariant(l.salesPrice, l.extraPrice ?? 0),
    })),
  };
}
