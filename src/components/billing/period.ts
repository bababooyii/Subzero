import { formatDateLong, formatPeriod } from "@/lib/format";

/** "Nov 1 – Nov 30", with the year when the period is long enough to be ambiguous (yearly plans). */
export function periodLabel(start: string, end: string): string {
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  return days > 300 ? `${formatDateLong(start)} – ${formatDateLong(end)}` : formatPeriod(start, end);
}
