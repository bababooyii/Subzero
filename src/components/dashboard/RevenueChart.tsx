"use client";

import { BarChart } from "@/components/ui/BarChart";
import type { RevenuePeriod } from "@/lib/mock/selectors";

/** Fills its parent's height. Bars are months, or 15-day halves for the 3-month view. */
export function RevenueChart({ data }: { data: RevenuePeriod[] }) {
  return (
    <BarChart
      data={data.map((d) => ({ label: d.label, detail: d.range, value: d.invoiced, secondary: d.collected }))}
      seriesLabel="Invoiced"
      secondaryLabel="Collected"
    />
  );
}
