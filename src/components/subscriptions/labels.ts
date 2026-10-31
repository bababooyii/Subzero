import type { Interval, PaymentMethod } from "@/lib/mock/types";

export const INTERVAL_LABEL: Record<Interval, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};

/** Adds whole months to an ISO date (UTC), clamping to the last day of the month. */
export function addMonthsISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}
