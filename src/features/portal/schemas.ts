import { z } from "zod";

export const subscriptionIdSchema = z.object({ id: z.string().uuid() });
export type SubscriptionIdInput = z.infer<typeof subscriptionIdSchema>;

export const invoiceIdSchema = z.object({ id: z.string().uuid() });
export type InvoiceIdInput = z.infer<typeof invoiceIdSchema>;

export const payMyInvoiceInput = z.object({
  invoiceId: z.string().uuid(),
  method: z.enum(["upi", "card", "bank_transfer", "cash"]),
});
export type PayMyInvoiceInput = z.infer<typeof payMyInvoiceInput>;

export const acceptQuotationInput = z.object({ subscriptionId: z.string().uuid() });
export type AcceptQuotationInput = z.infer<typeof acceptQuotationInput>;

export const updateMyContactInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(500).optional(),
});
export type UpdateMyContactInput = z.infer<typeof updateMyContactInput>;
