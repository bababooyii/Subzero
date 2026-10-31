"use client";

import { BarChart } from "@/components/ui/BarChart";

export type RevenuePeriod = { key: string; label: string; range: string; invoiced: number; collected: number };

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
