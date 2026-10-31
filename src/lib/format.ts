import { TODAY } from "@/lib/mock/clock";

const IST = "Asia/Kolkata";

const money0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Integer paise → "₹2,41,800" (no decimals when whole, otherwise 2). */
export function formatMoney(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const value = abs / 100;
  return `${sign}₹${abs % 100 === 0 ? money0.format(value) : money2.format(value)}`;
}

/** Compact money for tight spots: ₹4.2L, ₹1.3Cr, ₹48K. */
export function formatMoneyCompact(minor: number): string {
  const v = Math.abs(minor) / 100;
  const sign = minor < 0 ? "-" : "";
  if (v >= 1e7) return `${sign}₹${trim(v / 1e7)}Cr`;
  if (v >= 1e5) return `${sign}₹${trim(v / 1e5)}L`;
  if (v >= 1e3) return `${sign}₹${trim(v / 1e3)}K`;
  return `${sign}₹${Math.round(v)}`;
}

function trim(n: number) {
  return n.toFixed(1).replace(/\.0$/, "");
}

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(d);
const md = new Intl.DateTimeFormat("en-US", { timeZone: IST, month: "short", day: "numeric" });
const wmd = new Intl.DateTimeFormat("en-US", { timeZone: IST, weekday: "short", month: "short", day: "numeric" });

/** "Today, Oct 31" for the mock today, otherwise "Sat, Oct 18". */
export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (dayKey(date) === dayKey(TODAY)) return `Today, ${md.format(date)}`;
  return wmd.format(date);
}

/** "Nov 1 – Nov 30" */
export function formatPeriod(a: Date | string, b: Date | string): string {
  const x = typeof a === "string" ? new Date(a) : a;
  const y = typeof b === "string" ? new Date(b) : b;
  return `${md.format(x)} – ${md.format(y)}`;
}

/** "Oct 31, 2026" */
export function formatDateLong(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { timeZone: IST, year: "numeric", month: "short", day: "numeric" }).format(date);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

/** "10:42 AM" in IST. */
export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { timeZone: IST, hour: "numeric", minute: "2-digit" }).format(date);
}

/** "Today, Oct 31 · 10:42 AM" */
export function formatDateTime(d: Date | string): string {
  return `${formatDate(d)} · ${formatTime(d)}`;
}
