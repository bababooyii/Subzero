import { sql } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import type { PlanStats } from "@/components/catalog/catalog-utils";
import { dashboardKpis } from "@/features/dashboard/queries";

// TODO(backend): a `planStats` query in `features/catalog/queries.ts` would replace this file. Active count and MRR
// come from `dashboardKpis` (one call per plan, so MRR matches the dashboard); only "new per month" needs its own SQL.

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Card stats per plan id: active subscriptions, MRR, share of all active subscriptions, new per month (last 6). */
export async function planStats(db: DB | Tx, planIds: string[], today: string): Promise<Record<string, PlanStats>> {
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 6 + i, 1));
    return { key: d.toISOString().slice(0, 7), label: MONTH_SHORT[d.getUTCMonth()] };
  });
  const start = `${months[0].key}-01`;
  const end = new Date(Date.UTC(ty, tm, 0)).toISOString().slice(0, 10);

  const [all, perPlan, started] = await Promise.all([
    dashboardKpis(db, { from: today, to: today, today }),
    Promise.all(planIds.map((planId) => dashboardKpis(db, { from: today, to: today, planId, today }))),
    db.execute(sql`
      select plan_id, to_char(start_date, 'YYYY-MM') as month, count(*)::int as cnt
      from subscriptions
      where status in ('active', 'paused', 'closed') and start_date between ${start}::date and ${end}::date
      group by 1, 2`) as unknown as Promise<{ plan_id: string; month: string; cnt: number }[]>,
  ]);

  const totalActive = all.activeSubscriptions || 1;
  const out: Record<string, PlanStats> = {};
  planIds.forEach((id, i) => {
    const k = perPlan[i];
    out[id] = {
      active: k.activeSubscriptions,
      mrr: k.mrr,
      share: k.activeSubscriptions / totalActive,
      monthly: months.map((m) => ({
        label: m.label,
        count: Number(started.find((s) => s.plan_id === id && s.month === m.key)?.cnt ?? 0),
      })),
    };
  });
  return out;
}
