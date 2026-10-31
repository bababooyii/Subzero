import type { PortalInvoice, PortalSub } from "./types";

/** Invoices with money still owed, overdue first, then by due date. */
export function unpaidInvoices(invoices: PortalInvoice[]): PortalInvoice[] {
  return invoices
    .filter((i) => i.balance > 0)
    .sort((a, b) => Number(b.status === "overdue") - Number(a.status === "overdue") || a.dueDate.localeCompare(b.dueDate));
}

export const outstanding = (invoices: PortalInvoice[]) => invoices.reduce((n, i) => n + i.balance, 0);

/** Active subscriptions that will bill again, soonest first. */
export function upcomingCharges(subs: PortalSub[]): (PortalSub & { nextBillingDate: string })[] {
  return subs
    .filter((s): s is PortalSub & { nextBillingDate: string } => s.status === "active" && !!s.nextBillingDate)
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));
}

/** Money paid on invoices issued this year (cancelled ones excluded). */
export function paidThisYear(invoices: PortalInvoice[], today: string): number {
  const year = today.slice(0, 4);
  return invoices
    .filter((i) => i.status !== "cancelled" && i.issueDate.startsWith(year))
    .reduce((n, i) => n + (i.total - i.balance), 0);
}

/** Paid invoices, newest first. */
export const recentlyPaid = (invoices: PortalInvoice[]) =>
  invoices.filter((i) => i.status === "paid").sort((a, b) => b.issueDate.localeCompare(a.issueDate));

export type ProjectedCharge = { key: string; sub: PortalSub; date: string; amount: number };

const DAY = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** The date of the k-th billing after `base`, counted from `base` itself so month ends do not drift. */
function nth(base: Date, interval: PortalSub["interval"], k: number): Date {
  const d = new Date(base);
  if (interval === "daily") d.setUTCDate(d.getUTCDate() + k);
  else if (interval === "weekly") d.setUTCDate(d.getUTCDate() + 7 * k);
  else if (interval === "monthly") d.setUTCMonth(d.getUTCMonth() + k);
  else d.setUTCFullYear(d.getUTCFullYear() + k);
  return d;
}

/** Every charge the active subscriptions will make in the next `days` days, soonest first (capped at 60). */
export function projectedCharges(subs: PortalSub[], today: string, days = 90): ProjectedCharge[] {
  const end = toIso(new Date(toDate(today).getTime() + days * DAY));
  const out: ProjectedCharge[] = [];
  for (const sub of subs) {
    if (sub.status !== "active" || !sub.nextBillingDate) continue;
    const base = toDate(sub.nextBillingDate);
    for (let k = 0; k < 60; k++) {
      const date = toIso(nth(base, sub.interval, k * sub.intervalCount));
      if (date > end) break;
      out.push({ key: `${sub.id}-${date}`, sub, date, amount: sub.amount });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.sub.number.localeCompare(b.sub.number)).slice(0, 60);
}
