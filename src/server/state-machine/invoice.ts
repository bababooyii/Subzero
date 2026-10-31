import type { TransitionResult } from "./subscription";

export const INVOICE_STATUSES = ["draft", "confirmed", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceAction = "confirm" | "cancel" | "mark_paid";

/** Money in integer paise. */
export type InvoiceCtx = { total: number; amountPaid: number };

type Rule = {
  from: InvoiceStatus;
  to: InvoiceStatus;
  action: InvoiceAction;
  label: string;
  guard?: (ctx: InvoiceCtx) => string | null;
};

const RULES: readonly Rule[] = [
  { from: "draft", to: "confirmed", action: "confirm", label: "Confirm" },
  { from: "draft", to: "cancelled", action: "cancel", label: "Cancel" },
  {
    from: "confirmed",
    to: "cancelled",
    action: "cancel",
    label: "Cancel",
    guard: (ctx) => (ctx.amountPaid === 0 ? null : "Cannot cancel an invoice with payments"),
  },
  {
    from: "confirmed",
    to: "paid",
    action: "mark_paid",
    label: "Mark paid",
    guard: (ctx) => (ctx.amountPaid >= ctx.total ? null : "Invoice is not fully paid"),
  },
];

export function canTransitionInvoice(
  from: InvoiceStatus,
  to: InvoiceStatus,
  ctx: InvoiceCtx,
): TransitionResult {
  const rule = RULES.find((r) => r.from === from && r.to === to);
  if (!rule) return { ok: false, reason: `Cannot move an invoice from ${from} to ${to}` };
  const blocked = rule.guard?.(ctx) ?? null;
  return blocked ? { ok: false, reason: blocked } : { ok: true };
}

export function availableInvoiceActions(
  status: InvoiceStatus,
  ctx: InvoiceCtx,
): { action: InvoiceAction; to: InvoiceStatus; label: string }[] {
  return RULES.filter((r) => r.from === status && !r.guard?.(ctx)).map((r) => ({
    action: r.action,
    to: r.to,
    label: r.label,
  }));
}
