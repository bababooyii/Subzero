import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const uuid = z.string().uuid();

export const subscriptionLineInput = z.object({
  productId: uuid,
  variantId: uuid.nullable().default(null),
  quantity: z.number().int().min(1),
  /** Optional override in paise; otherwise the catalog price is used. */
  unitPrice: z.number().int().min(0).optional(),
});

export const subscriptionInput = z
  .object({
    customerId: uuid,
    planId: uuid,
    startDate: isoDate,
    expiryDate: isoDate.nullable().default(null),
    paymentTermId: uuid,
    lines: z.array(subscriptionLineInput).min(1, "Add at least one line"),
  })
  .refine((v) => v.expiryDate === null || v.expiryDate >= v.startDate, {
    message: "Expiry date must be on or after the start date",
    path: ["expiryDate"],
  });

export const fromTemplateInput = z.object({
  templateId: uuid,
  customerId: uuid,
  startDate: isoDate,
});

export const SUBSCRIPTION_ACTIONS = [
  "send_quotation",
  "confirm",
  "activate",
  "pause",
  "resume",
  "close",
  "cancel",
  "revise",
] as const;

export const applyActionInput = z.object({
  id: uuid,
  action: z.enum(SUBSCRIPTION_ACTIONS),
});

export const renewInput = z.object({ id: uuid });

export const SUBSCRIPTION_VIEWS = [
  "all",
  "active",
  "paused",
  "due_today",
  "closing_this_month",
  "quotations",
] as const;

export type SubscriptionInput = z.input<typeof subscriptionInput>;
export type SubscriptionInputParsed = z.output<typeof subscriptionInput>;
export type FromTemplateInput = z.input<typeof fromTemplateInput>;
export type ApplyActionInput = z.input<typeof applyActionInput>;
export type SubscriptionView = (typeof SUBSCRIPTION_VIEWS)[number];
