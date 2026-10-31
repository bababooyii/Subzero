import { discountUsagePct } from "./catalog-utils";

/** usedCount / usageLimit as a thin grey bar with a count. Unlimited discounts show the count only. */
export function UsageBar({ discount }: { discount: { usedCount: number; usageLimit: number | null } }) {
  const pct = discountUsagePct(discount);
  if (pct === null) {
    return <span className="text-muted tabular-nums">{discount.usedCount} used · no limit</span>;
  }
  return (
    <span className="flex items-center gap-2.5">
      <span
        role="progressbar"
        aria-label="Usage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10"
      >
        <span className="block h-full rounded-full bg-text/70" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-muted tabular-nums">
        {discount.usedCount}/{discount.usageLimit}
      </span>
    </span>
  );
}
