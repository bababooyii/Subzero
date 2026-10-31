import { z } from "zod";

const paise = z.number().int().min(0);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const variantInput = z.object({
  id: z.string().uuid().optional(),
  attribute: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(60),
  extraPrice: paise,
});

export const productInput = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["service", "goods"]),
  salesPrice: paise,
  costPrice: paise,
  notes: z.string().max(2000).optional(),
  taxIds: z.array(z.string().uuid()),
  variants: z.array(variantInput),
});

export const planInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    price: paise,
    interval: z.enum(["daily", "weekly", "monthly", "yearly"]),
    intervalCount: z.number().int().min(1).max(36),
    minQty: z.number().int().min(1),
    availableFrom: dateString,
    availableTo: dateString.nullable(),
    autoClose: z.boolean(),
    closable: z.boolean(),
    pausable: z.boolean(),
    renewable: z.boolean(),
  })
  .refine((p) => p.availableTo === null || p.availableTo >= p.availableFrom, {
    message: "Available to must be on or after available from",
    path: ["availableTo"],
  });

export const taxInput = z.object({
  name: z.string().trim().min(1).max(120),
  rateBps: z.number().int().min(0).max(10000),
});

export const paymentTermInput = z.object({
  name: z.string().trim().min(1).max(120),
  dueDays: z.number().int().min(0).max(365),
});

export const templateLineInput = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1),
});

export const templateInput = z.object({
  name: z.string().trim().min(1).max(120),
  validityDays: z.number().int().min(1).max(365),
  planId: z.string().uuid(),
  paymentTermId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  lines: z.array(templateLineInput).min(1),
});

export type VariantInput = z.infer<typeof variantInput>;
export type ProductInput = z.infer<typeof productInput>;
export type PlanInput = z.infer<typeof planInput>;
export type TaxInput = z.infer<typeof taxInput>;
export type PaymentTermInput = z.infer<typeof paymentTermInput>;
export type TemplateLineInput = z.infer<typeof templateLineInput>;
export type TemplateInput = z.infer<typeof templateInput>;
