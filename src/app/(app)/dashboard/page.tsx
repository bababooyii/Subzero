import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { OverdueTable, type OverdueRow } from "@/components/dashboard/OverdueTable";
import { RevenueChart, type RevenuePeriod } from "@/components/dashboard/RevenueChart";
import { AgeingBars } from "@/components/ui/AgeingBars";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { StatTile } from "@/components/ui/StatTile";
import { Timeline } from "@/components/ui/Timeline";
import { db } from "@/db/client";
import { listPlans } from "@/features/catalog/queries";
import { dashboardKpis, navCounts, overdueAgeing, overdueInvoices, revenueByMonth } from "@/features/dashboard/queries";
import { todayIST } from "@/lib/dates";
import { formatMoneyCompact } from "@/lib/format";
import { sectionTitle, surface } from "@/lib/ui";
import { loadRecentActivity } from "./recent-activity";
import { revenueByHalfMonth } from "./revenue-halves";

export const metadata = { title: "Dashboard · Brightloop" };

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Percent change as a delta line, or nothing when there is no previous value to compare with. */
const pct = (n: number | null, suffix: string) => (n === null ? undefined : `${n > 0 ? "+" : ""}${n}% ${suffix}`);
const tone = (n: number | null) => (n === null || n === 0 ? "neutral" : n > 0 ? "good" : "bad");

const AGEING_LABELS = { "0-30": "0–30 days", "31-60": "31–60 days", "60+": "60+ days" } as const;

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Dashboard {...props} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const today = todayIST();
  const planParam = typeof sp.plan === "string" ? sp.plan : "";
  const plans = (await listPlans(db, { pageSize: 200 })).rows;
  const plan = plans.some((p) => p.id === planParam) ? planParam : "";
  const planId = plan || undefined;
  const months = sp.months === "3" ? 3 : 6;
  const monthIndex = Number(today.slice(5, 7)) - 1;
  const prevMonth = MONTH_SHORT[(monthIndex + 11) % 12];

  const [k, revenue, ageing, overdue, counts, events] = await Promise.all([
    dashboardKpis(db, { from: `${today.slice(0, 7)}-01`, to: today, planId, today }),
    loadRevenue(months, planId, today),
    overdueAgeing(db, { today }),
    overdueInvoices(db, { limit: 20, today }),
    navCounts(db, today),
    loadRecentActivity(12),
  ]);
  const rows: OverdueRow[] = overdue.map((i) => ({
    id: i.id,
    number: i.number,
    customer: i.customerName,
    dueDate: i.dueDate,
    daysOverdue: i.daysOverdue,
    balance: i.balance,
  }));
  const { dueToday } = counts;

  return (
    <PageGrid
      left={
        <>
          <Intro
            icon={<ChartColumn />}
            title={`${MONTH_LONG[monthIndex]} so far`}
            subtitle={`${formatMoneyCompact(k.collected)} collected · ${k.overdue.count} invoices overdue · ${dueToday} due to bill today`}
          />
          <DashboardFilters plans={plans.map((p) => ({ id: p.id, name: p.name }))} plan={plan} months={months} />
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-5">
          <StatTile index={0} label="Active subscriptions" value={k.activeSubscriptions} delta={pct(k.deltas.activeSubscriptions, "this month")} tone={tone(k.deltas.activeSubscriptions)} />
          <StatTile index={1} label="MRR" value={k.mrr} format="compact" delta={pct(k.deltas.mrr, `vs ${prevMonth}`)} tone={tone(k.deltas.mrr)} />
          <StatTile index={2} label="Collected this month" value={k.collected} format="compact" delta={pct(k.deltas.collected, "vs previous period")} tone={tone(k.deltas.collected)} />
          <StatTile index={3} label="Outstanding" value={k.outstanding} format="compact" delta="Unpaid balance" />
          <StatTile index={4} label="Overdue" value={k.overdue.amount} format="compact" delta={`${k.overdue.count} invoices`} tone={k.overdue.count ? "bad" : "neutral"} />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] grid-rows-[clamp(232px,32%,320px)_minmax(0,1fr)] gap-4">
          <section className={`${surface} flex min-h-0 animate-rise flex-col p-5`} style={{ animationDelay: "320ms" }}>
            <h2 className={`${sectionTitle} mb-3 shrink-0`}>Revenue invoiced</h2>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <RevenueChart data={revenue} />
            </div>
          </section>
          <section className={`${surface} flex min-h-0 animate-rise flex-col p-5`} style={{ animationDelay: "380ms" }}>
            <h2 className={`${sectionTitle} mb-1 shrink-0`}>Overdue ageing</h2>
            <p className="mb-3 shrink-0 text-[12px] text-muted">Open balance by days past due.</p>
            <AgeingBars buckets={ageing.map((b) => ({ key: b.bucket, label: AGEING_LABELS[b.bucket], count: b.count, amount: b.amount }))} className="my-auto gap-5" />
          </section>

          <section className="flex min-h-0 animate-rise flex-col gap-3" style={{ animationDelay: "440ms" }}>
            <div className="flex shrink-0 items-baseline justify-between">
              <h2 className={sectionTitle}>Overdue invoices</h2>
              <Link href="/invoices" className="text-[12px] text-muted hover:text-text">
                View all
              </Link>
            </div>
            <div className="min-h-0 flex-1">
              <OverdueTable rows={rows} />
            </div>
          </section>
          <section className={`${surface} flex min-h-0 animate-rise flex-col p-5 pb-0`} style={{ animationDelay: "500ms" }}>
            <h2 className={`${sectionTitle} mb-3 shrink-0`}>Recent activity</h2>
            <ScrollPanel className="-mx-1 flex-1 px-1 pb-5">
              <Timeline events={events.map((e) => ({ id: e.id, at: e.at, text: e.sentence }))} empty="Activity coming soon." />
            </ScrollPanel>
          </section>
        </div>
      </div>
    </PageGrid>
  );
}

/** Three months or fewer use 15-day halves so the chart never shows just three bars; longer ranges keep monthly bars. */
async function loadRevenue(months: number, planId: string | undefined, today: string): Promise<RevenuePeriod[]> {
  if (months <= 3) return revenueByHalfMonth(db, { months, planId, today });
  const rows = await revenueByMonth(db, { months, planId, today });
  return rows.map((m) => {
    const name = MONTH_SHORT[Number(m.month.slice(5)) - 1];
    return { key: m.month, label: name, range: name, invoiced: m.invoiced, collected: m.collected };
  });
}
