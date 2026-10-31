import { z } from "zod";

export const INVOICE_VIEWS = [
  "all",
  "draft",
  "unpaid",
  "overdue",
  "paid",
] as const;
export type InvoiceView = (typeof INVOICE_VIEWS)[number];

export const INVOICE_STATUSES = [
  "draft",
  "confirmed",
  "paid",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Status as shown in the UI: adds derived `overdue` / `partially_paid`. */
export type InvoiceDisplayStatus = InvoiceStatus | "overdue" | "partially_paid";

export const invoiceIdInput = z.string().uuid();
export const invoiceIdsInput = z.array(z.string().uuid()).min(1).max(200);

export type InvoiceAction = "confirm" | "cancel";
