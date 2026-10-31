import { z } from "zod";
import { todayIST } from "@/lib/dates";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const paymentInput = z.object({
  invoiceId: z.string().uuid(),
  method: z.enum(["upi", "card", "bank_transfer", "cash"]),
  /** Paise. */
  amount: z.number().int().min(1, "Amount must be positive"),
  paidOn: isoDate.refine((d) => d <= todayIST(), "Payment date cannot be in the future"),
  note: z.string().trim().max(500).nullable().optional(),
});

export type PaymentInput = z.input<typeof paymentInput>;
export type PaymentInputParsed = z.output<typeof paymentInput>;
