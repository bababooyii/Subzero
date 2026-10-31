/** Date-only helpers on "YYYY-MM-DD" strings, computed in UTC to avoid TZ bugs. */
export type DateOnly = string;
export type Interval = "daily" | "weekly" | "monthly" | "yearly";

function parse(date: DateOnly): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function format(y: number, m: number, d: number): DateOnly {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: DateOnly, days: number): DateOnly {
  const { y, m, d } = parse(date);
  return format(y, m, d + days);
}

function addMonths(date: DateOnly, months: number): DateOnly {
  const { y, m, d } = parse(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return format(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Add `count` intervals, clamping to month end (Jan 31 + 1 month = Feb 28/29). */
export function addInterval(
  date: DateOnly,
  interval: Interval,
  count = 1,
): DateOnly {
  switch (interval) {
    case "daily":
      return addDays(date, count);
    case "weekly":
      return addDays(date, 7 * count);
    case "monthly":
      return addMonths(date, count);
    case "yearly":
      return addMonths(date, 12 * count);
  }
}

/** Last day of the period starting at `start` (next start minus one day). */
export function periodEnd(
  start: DateOnly,
  interval: Interval,
  count = 1,
): DateOnly {
  return addDays(addInterval(start, interval, count), -1);
}

/** Today's date in Asia/Kolkata as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): DateOnly {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
