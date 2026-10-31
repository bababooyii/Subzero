import { sql, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import type { RevenuePeriod } from "@/components/dashboard/RevenueChart";

// TODO(backend): move into `features/dashboard/queries.ts` next to `revenueByMonth`. The backend only returns
// whole months, and the 3-month chart splits each month into 1-15 and 16-end halves.

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Db = DB | Tx;
type Cell = { month: string; half: string; amt: string };

/** Invoiced (confirmed or paid, by issue date) and collected (payments, by paid date) per half month, zero-filled. */
export async function revenueByHalfMonth(
  db: Db,
  params: { months: number; planId?: string; today: string },
): Promise<RevenuePeriod[]> {
  const { months, planId, today } = params;
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const first = new Date(Date.UTC(ty, tm - months, 1));
  const start = first.toISOString().slice(0, 10);
  const end = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);
  const plan: SQL = planId ? sql` and s.plan_id = ${planId}` : sql``;

  const run = async (query: SQL) => (await db.execute(query)) as unknown as Cell[];
  const [inv, pay] = await Promise.all([
    run(sql`
      select to_char(i.issued_on, 'YYYY-MM') as month,
        case when extract(day from i.issued_on) <= 15 then '1' else '2' end as half,
        sum(i.total)::bigint as amt
      from invoices i join subscriptions s on s.id = i.subscription_id
      where i.status in ('confirmed', 'paid')
        and i.issued_on between ${start}::date and ${end}::date ${plan}
      group by 1, 2`),
    run(sql`
      select to_char(p.paid_on, 'YYYY-MM') as month,
        case when extract(day from p.paid_on) <= 15 then '1' else '2' end as half,
        sum(p.amount)::bigint as amt
      from payments p
      join invoices i on i.id = p.invoice_id
      join subscriptions s on s.id = i.subscription_id
      where p.paid_on between ${start}::date and ${end}::date ${plan}
      group by 1, 2`),
  ]);
  const sum = (cells: Cell[], month: string, half: string) =>
    Number(cells.find((c) => c.month === month && c.half === half)?.amt ?? 0);

  const out: RevenuePeriod[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(ty, tm - months + i, 1));
    const month = d.toISOString().slice(0, 7);
    const name = MONTH_SHORT[d.getUTCMonth()];
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    for (const [half, from, to] of [
      ["1", 1, 15],
      ["2", 16, lastDay],
    ] as const) {
      out.push({
        key: `${month}-${String(from).padStart(2, "0")}`,
        label: `${name} ${from}`,
        range: `${name} ${from}–${to}`,
        invoiced: sum(inv, month, half),
        collected: sum(pay, month, half),
      });
    }
  }
  return out;
}
