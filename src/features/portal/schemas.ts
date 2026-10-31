import { z } from "zod";

export const subscriptionIdSchema = z.object({ id: z.string().uuid() });
export type SubscriptionIdInput = z.infer<typeof subscriptionIdSchema>;

export const invoiceIdSchema = z.object({ id: z.string().uuid() });
export type InvoiceIdInput = z.infer<typeof invoiceIdSchema>;
