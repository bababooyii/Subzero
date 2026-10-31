import type { Interval } from "@/lib/dates";

/** "month" for a monthly plan, used in "₹2,499 / month". */
export const INTERVAL_NOUN: Record<Interval, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

/** "month", or "3 months" for a plan billed every 3 months. */
export function intervalNoun(interval: Interval, count: number): string {
  const noun = INTERVAL_NOUN[interval];
  return count > 1 ? `${count} ${noun}s` : noun;
}
