/**
 * Catalog helpers: labels and small pure functions shared by the catalog views. No database access,
 * so client components can import them freely.
 */

export type ProductType = "service" | "goods";
export type Interval = "daily" | "weekly" | "monthly" | "yearly";

export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "service", label: "Service" },
  { value: "goods", label: "Goods" },
];

export function productTypeLabel(type: ProductType): string {
  return PRODUCT_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Margin on the sales price as a whole percent, or null when there is no price. */
export function productMargin(p: { salesPrice: number; costPrice: number }): number | null {
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

export type PlanData = {
  id: string;
  name: string;
  price: number;
  interval: Interval;
  intervalCount: number;
  minQty: number;
  availableFrom: string | null;
  availableTo: string | null;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
};

export type PlanFlagKey = "autoClose" | "closable" | "pausable" | "renewable";

export const PLAN_FLAGS: { key: PlanFlagKey; label: string; description: string }[] = [
  { key: "autoClose", label: "Auto-close", description: "Closes on the plan's end date." },
  { key: "closable", label: "Closable", description: "Customers can close the subscription." },
  { key: "pausable", label: "Pausable", description: "Customers can pause and resume." },
  { key: "renewable", label: "Renewable", description: "Renews at the end of each period." },
];

export type PlanStats = {
  active: number;
  /** Monthly recurring revenue from the plan's active subscriptions, in paise. */
  mrr: number;
  /** Share of all active subscriptions, 0 to 1. */
  share: number;
  /** New subscriptions per month for the last six months, oldest first. */
  monthly: { label: string; count: number }[];
};

export type DiscountStatus = "active" | "scheduled" | "expired" | "used_up" | "inactive";

export const DISCOUNT_STATUS_LABEL: Record<DiscountStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  used_up: "Used up",
  inactive: "Inactive",
};

/** Share of the usage limit already used, 0 to 100. Null when the discount has no limit. */
export function discountUsagePct(d: { usageLimit: number | null; usedCount: number }): number | null {
  if (d.usageLimit === null) return null;
  if (d.usageLimit <= 0) return 100;
  return Math.min(100, Math.round((d.usedCount / d.usageLimit) * 100));
}

/** Basis points as a percent string without trailing zeros: 1800 → "18", 1250 → "12.5". */
export const bpsToPercent = (bps: number): string => String(Math.round(bps) / 100);

/** "18" → 1800. Blank or invalid → 0. */
export const percentToBps = (s: string): number => {
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
