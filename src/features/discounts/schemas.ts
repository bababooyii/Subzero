import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const uuid = z.string().uuid();

export const discountInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    kind: z.enum(["fixed", "percent"]),
    /** Paise for fixed, basis points for percent. */
    value: z.number().int().min(1, "Value must be positive"),
    scope: z.enum(["products", "subscription"]),
    productIds: z.array(uuid).default([]),
    minAmount: z.number().int().min(0).nullable().default(null),
    minQty: z.number().int().min(1).nullable().default(null),
    startsOn: isoDate.nullable().default(null),
    endsOn: isoDate.nullable().default(null),
    usageLimit: z.number().int().min(1).nullable().default(null),
    active: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "percent" && v.value > 10000) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Percent cannot exceed 100%" });
    }
    if (v.scope === "products" && v.productIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["productIds"], message: "Pick at least one product" });
    }
    if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) {
      ctx.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after the start date" });
    }
  });

export type DiscountInput = z.input<typeof discountInput>;
export type DiscountInputParsed = z.output<typeof discountInput>;

export const discountStatus = z.enum(["active", "scheduled", "expired", "used_up", "inactive"]);
export type DiscountStatus = z.infer<typeof discountStatus>;
