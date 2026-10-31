/**
 * Catalog helpers (Lane D). Pure functions over the mock types, with no database access,
 * so client components can import them without pulling the mock generator into the bundle.
 */
import { TODAY_ISO } from "./clock";
import type { Discount, Interval, Product, ProductType, Subscription } from "./types";

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "service", label: "Service" },
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "addon", label: "Add-on" },
];

export function productTypeLabel(type: ProductType): string {
  return PRODUCT_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Margin on the sales price as a whole percent, or null when there is no price. */
export function productMargin(p: Pick<Product, "salesPrice" | "costPrice">): number | null {
  if (p.salesPrice <= 0) return null;
  return Math.round(((p.salesPrice - p.costPrice) / p.salesPrice) * 100);
}

export const INTERVALS: { value: Interval; label: string; unit: string }[] = [
  { value: "daily", label: "Daily", unit: "day" },
  { value: "weekly", label: "Weekly", unit: "week" },
  { value: "monthly", label: "Monthly", unit: "month" },
  { value: "yearly", label: "Yearly", unit: "year" },
];

export const intervalLabel = (i: Interval) => INTERVALS.find((x) => x.value === i)?.label ?? i;
export const intervalUnit = (i: Interval) => INTERVALS.find((x) => x.value === i)?.unit ?? i;

export type PlanFlagKey = "autoClose" | "closable" | "pausable" | "renewable";

export const PLAN_FLAGS: { key: PlanFlagKey; label: string; description: string }[] = [
  { key: "autoClose", label: "Auto-close", description: "Closes on the plan's end date." },
  { key: "closable", label: "Closable", description: "Customers can close the subscription." },
  { key: "pausable", label: "Pausable", description: "Customers can pause and resume." },
  { key: "renewable", label: "Renewable", description: "Renews at the end of each period." },
];

export type DiscountStatus = "active" | "scheduled" | "expired" | "used_up";

/** Used up wins over expired, which wins over scheduled. Dates are ISO strings, so they compare as text. */
export function discountStatus(d: Discount, today: string = TODAY_ISO): DiscountStatus {
  if (d.usageLimit !== null && d.timesUsed >= d.usageLimit) return "used_up";
  if (d.end < today) return "expired";
  if (d.start > today) return "scheduled";
  return "active";
}

export const DISCOUNT_STATUS_LABEL: Record<DiscountStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  used_up: "Used up",
};

/** Share of the usage limit already used, 0 to 100. Null when the discount has no limit. */
export function discountUsagePct(d: Pick<Discount, "usageLimit" | "timesUsed">): number | null {
  if (d.usageLimit === null) return null;
  if (d.usageLimit <= 0) return 100;
  return Math.min(100, Math.round((d.timesUsed / d.usageLimit) * 100));
}

/** Number of active subscriptions per plan id. Plans with none are absent, so read it with `?? 0`. */
export function activeSubscriptionsByPlan(subs: Pick<Subscription, "planId" | "status">[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of subs) if (s.status === "active") counts[s.planId] = (counts[s.planId] ?? 0) + 1;
  return counts;
}

export type PlanStats = {
  active: number;
  /** Monthly recurring revenue from the plan's active subscriptions, in paise. */
  mrr: number;
  /** Share of all active subscriptions, 0 to 1. */
  share: number;
  /** New subscriptions per month for the last six months, oldest first. */
  monthly: { label: string; count: number }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Per-plan card stats. `mrrOf` is passed in so this stays free of the mock generator. */
export function planStats(
  subs: Pick<Subscription, "planId" | "status" | "startDate">[],
  mrrOf: (s: Pick<Subscription, "planId" | "status" | "startDate">) => number,
  today: string = TODAY_ISO,
): Record<string, PlanStats> {
  const [y, m] = today.split("-").map(Number);
  const keys = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 6 + i, 1));
    return { key: d.toISOString().slice(0, 7), label: MONTHS[d.getUTCMonth()] };
  });
  const totalActive = subs.filter((s) => s.status === "active").length || 1;
  const out: Record<string, PlanStats> = {};
  for (const s of subs) {
    const st = (out[s.planId] ??= { active: 0, mrr: 0, share: 0, monthly: keys.map((k) => ({ label: k.label, count: 0 })) });
    if (s.status === "active") {
      st.active += 1;
      st.mrr += mrrOf(s);
    }
    const i = keys.findIndex((k) => k.key === s.startDate.slice(0, 7));
    if (i >= 0) st.monthly[i].count += 1;
  }
  for (const st of Object.values(out)) st.share = st.active / totalActive;
  return out;
}
