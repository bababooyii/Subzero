import type { Interval } from "@/lib/mock/types";

/** "month" for a monthly plan, used in "₹2,499 / month". */
export const INTERVAL_NOUN: Record<Interval, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};
