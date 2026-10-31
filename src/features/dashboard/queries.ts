import { sql, type SQL } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { addDays } from "@/lib/dates";

/** Aggregates for the admin dashboard. Everything is computed in SQL; money is integer paise. */

type Db = DB | Tx;

export type KpiParams = { from: string; to: string; planId?: string; today: string };

export type DashboardKpis = {
  /** Subscriptions active on `to`. */
  activeSubscriptions: number;
  /** Monthly recurring revenue (pre-tax) of subscriptions active on `to`. */
  mrr: number;
  /** Payments received in [from, to]. */
  collected: number;
  /** Unpaid balance on all confirmed invoices as of `today`. */
  outstanding: number;
  /** Confirmed invoices past their due date as of `today`. */
  overdue: { count: number; amount: number };
  /** Percent change vs the previous period of the same length, 1 decimal; null when the previous value is 0. */
  deltas: {
    activeSubscriptions: number | null;
    mrr: number | null;
    collected: number | null;
  };
};

export type RevenueMonth = { month: string; invoiced: number; collected: number };
export type AgeingBucket = { bucket: "0-30" | "31-60" | "60+"; count: number; amount: number };
export type OverdueInvoice = {
  id: string;
  number: string;
  customerName: string;
  dueDate: string;
  daysOverdue: number;
  balance: number;
};

async function rows<T>(db: Db, query: SQL): Promise<T[]> {
  return (await db.execute(query)) as unknown as T[];
}

const planFilter = (alias: string, planId?: string) =>
  planId ? sql` and ${sql.raw(alias)}.plan_id = ${planId}` : sql``;

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Subscriptions that were active on `asOf`: started by then, and either still active
 * or paused/closed only after that date (exit date from the activity log).
 */
function activeAt(asOf: string, planId?: string): SQL {
  return sql`
    select s.id from subscriptions s
    where s.start_date <= ${asOf}::date
      and s.status in ('active', 'paused', 'closed')
      ${planFilter("s", planId)}
      and (s.status = 'active' or not exists (
        select 1 from activity_log a
        where a.entity_type = 'subscription' and a.entity_id = s.id::text
          and a.from_status = 'active' and a.to_status in ('paused', 'closed')
          and a.at::date <= ${asOf}::date))`;
}

/** Active count and MRR (daily x30, weekly x52/12, yearly /12, divided by interval_count). */
async function activeSnapshot(db: Db, asOf: string, planId?: string) {
  const [r] = await rows<{ cnt: string; mrr: string }>(
    db,
    sql`
      with act as (${activeAt(asOf, planId)}),
      rec as (
        select l.subscription_id, sum(l.quantity * l.unit_price)::bigint as amt
        from subscription_lines l join act on act.id = l.subscription_id
        group by l.subscription_id
      )
      select count(*) as cnt,
        coalesce(round(sum(coalesce(rec.amt, 0) * (case p.interval
            when 'daily' then 30::numeric
            when 'weekly' then 52::numeric / 12
            when 'yearly' then 1::numeric / 12
            else 1::numeric end) / p.interval_count)), 0)::bigint as mrr
      from act
      join subscriptions s on s.id = act.id
      join plans p on p.id = s.plan_id
      left join rec on rec.subscription_id = act.id`,
  );
  return { count: Number(r?.cnt ?? 0), mrr: Number(r?.mrr ?? 0) };
}

async function collectedBetween(db: Db, from: string, to: string, planId?: string) {
  const [r] = await rows<{ total: string }>(
    db,
    sql`
      select coalesce(sum(p.amount), 0)::bigint as total
      from payments p
      join invoices i on i.id = p.invoice_id
      join subscriptions s on s.id = i.subscription_id
      where p.paid_on between ${from}::date and ${to}::date
      ${planFilter("s", planId)}`,
  );
  return Number(r?.total ?? 0);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export async function dashboardKpis(db: Db, params: KpiParams): Promise<DashboardKpis> {
  const { from, to, planId, today } = params;
  const length = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -length);

  const [now, prev, collected, prevCollected, balances] = await Promise.all([
    activeSnapshot(db, to, planId),
    activeSnapshot(db, prevTo, planId),
    collectedBetween(db, from, to, planId),
    collectedBetween(db, prevFrom, prevTo, planId),
    rows<{ outstanding: string; overdue_count: string; overdue_amount: string }>(
      db,
      sql`
        select
          coalesce(sum(i.total - i.amount_paid), 0)::bigint as outstanding,
          count(*) filter (where i.due_date < ${today}::date) as overdue_count,
          coalesce(sum(i.total - i.amount_paid) filter (where i.due_date < ${today}::date), 0)::bigint as overdue_amount
        from invoices i
        join subscriptions s on s.id = i.subscription_id
        where i.status = 'confirmed' ${planFilter("s", planId)}`,
    ),
  ]);

  const b = balances[0];
  return {
    activeSubscriptions: now.count,
    mrr: now.mrr,
    collected,
    outstanding: Number(b?.outstanding ?? 0),
    overdue: { count: Number(b?.overdue_count ?? 0), amount: Number(b?.overdue_amount ?? 0) },
    deltas: {
      activeSubscriptions: pctChange(now.count, prev.count),
      mrr: pctChange(now.mrr, prev.mrr),
      collected: pctChange(collected, prevCollected),
    },
  };
}

/** Last `months` calendar months ending with the month of `today`, zero-filled. */
export async function revenueByMonth(
  db: Db,
  params: { months?: number; planId?: string; today: string },
): Promise<RevenueMonth[]> {
  const { months = 12, planId, today } = params;
  const result = await rows<{ month: string; invoiced: string; collected: string }>(
    db,
    sql`
      with m as (
        select generate_series(
          date_trunc('month', ${today}::date) - ((${months}::int - 1) * interval '1 month'),
          date_trunc('month', ${today}::date),
          interval '1 month')::date as start
      ),
      inv as (
        select date_trunc('month', i.issued_on)::date as start, sum(i.total)::bigint as amt
        from invoices i join subscriptions s on s.id = i.subscription_id
        where i.status in ('confirmed', 'paid') ${planFilter("s", planId)}
        group by 1
      ),
      pay as (
        select date_trunc('month', p.paid_on)::date as start, sum(p.amount)::bigint as amt
        from payments p
        join invoices i on i.id = p.invoice_id
        join subscriptions s on s.id = i.subscription_id
        where true ${planFilter("s", planId)}
        group by 1
      )
      select to_char(m.start, 'YYYY-MM') as month,
        coalesce(inv.amt, 0) as invoiced,
        coalesce(pay.amt, 0) as collected
      from m
      left join inv on inv.start = m.start
      left join pay on pay.start = m.start
      order by m.start`,
  );
  return result.map((r) => ({ month: r.month, invoiced: Number(r.invoiced), collected: Number(r.collected) }));
}

/** Unpaid balance of confirmed invoices past due, bucketed by days overdue. All three buckets always returned. */
export async function overdueAgeing(db: Db, params: { today: string }): Promise<AgeingBucket[]> {
  const found = await rows<{ bucket: AgeingBucket["bucket"]; cnt: string; amt: string }>(
    db,
    sql`
      select case when d <= 30 then '0-30' when d <= 60 then '31-60' else '60+' end as bucket,
        count(*) as cnt, sum(bal)::bigint as amt
      from (
        select (${params.today}::date - i.due_date) as d, (i.total - i.amount_paid) as bal
        from invoices i
        where i.status = 'confirmed' and i.due_date < ${params.today}::date
      ) x
      group by 1`,
  );
  return (["0-30", "31-60", "60+"] as const).map((bucket) => {
    const hit = found.find((f) => f.bucket === bucket);
    return { bucket, count: Number(hit?.cnt ?? 0), amount: Number(hit?.amt ?? 0) };
  });
}

/** Most overdue confirmed invoices first. */
export async function overdueInvoices(
  db: Db,
  params: { limit?: number; today: string },
): Promise<OverdueInvoice[]> {
  const { limit = 8, today } = params;
  const result = await rows<{
    id: string; number: string; customer_name: string; due_date: string; days_overdue: number; balance: string;
  }>(
    db,
    sql`
      select i.id, i.number, c.name as customer_name,
        to_char(i.due_date, 'YYYY-MM-DD') as due_date,
        (${today}::date - i.due_date)::int as days_overdue,
        (i.total - i.amount_paid)::bigint as balance
      from invoices i
      join customers c on c.id = i.customer_id
      where i.status = 'confirmed' and i.due_date < ${today}::date
      order by i.due_date asc, i.number asc
      limit ${limit}`,
  );
  return result.map((r) => ({
    id: r.id,
    number: r.number,
    customerName: r.customer_name,
    dueDate: r.due_date,
    daysOverdue: r.days_overdue,
    balance: Number(r.balance),
  }));
}

/** Sidebar chips: active subscriptions due (or past due) for invoicing, and overdue invoices. */
export async function navCounts(db: Db, today: string): Promise<{ dueToday: number; overdueInvoices: number }> {
  const [r] = await rows<{ due: string; overdue: string }>(
    db,
    sql`
      select
        (select count(*) from subscriptions where status = 'active' and next_invoice_date <= ${today}::date) as due,
        (select count(*) from invoices where status = 'confirmed' and due_date < ${today}::date) as overdue`,
  );
  return { dueToday: Number(r?.due ?? 0), overdueInvoices: Number(r?.overdue ?? 0) };
}
