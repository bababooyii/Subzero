import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { OverdueTable, type OverdueRow } from "@/components/dashboard/OverdueTable";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { AgeingBars } from "@/components/ui/AgeingBars";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { StatTile } from "@/components/ui/StatTile";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { Timeline } from "@/components/ui/Timeline";
import { formatMoneyCompact } from "@/lib/format";
import {
  customerName,
  daysOverdue,
  dashboardKpis,
  invoiceBalance,
  listPlans,
  overdueAgeing,
  overdueInvoices,
  recentActivity,
  revenueByPeriod,
  sidebarCounts,
} from "@/lib/mock/selectors";
import { sectionTitle, surface } from "@/lib/ui";

export const metadata = { title: "Dashboard · Brightloop" };

const pct = (n: number) => `${n > 0 ? "+" : ""}${n}%`;
const tone = (n: number) => (n > 0 ? "good" : n < 0 ? "bad" : "neutral");

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Dashboard {...props} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const planParam = typeof sp.plan === "string" ? sp.plan : "";
  const plans = listPlans();
  const plan = plans.some((p) => p.id === planParam) ? planParam : "";
  const months = sp.months === "3" ? 3 : 6;

  const k = dashboardKpis(plan || undefined);
  const revenue = revenueByPeriod(plan || undefined, months);
  const ageing = overdueAgeing(plan || undefined);
  const rows: OverdueRow[] = overdueInvoices(20, plan || undefined).map((i) => ({
    id: i.id,
    number: i.number,
    customer: customerName(i.customerId),
    dueDate: i.dueDate,
    daysOverdue: daysOverdue(i),
    balance: invoiceBalance(i),
  }));
  const events = recentActivity(12);
  const { dueToday } = sidebarCounts();

  return (
    <PageGrid
      left={
        <>
          <Intro
            icon={<ChartColumn />}
            title="October so far"
            subtitle={`${formatMoneyCompact(k.collected)} collected · ${k.overdueCount} invoices overdue · ${dueToday} due to bill today`}
          />
          <DashboardFilters plans={plans.map((p) => ({ id: p.id, name: p.name }))} plan={plan} months={months} />
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-5">
          <StatTile index={0} label="Active subscriptions" value={k.activeSubscriptions} delta={`+${k.activeDelta} this month`} tone="good" />
          <StatTile index={1} label="MRR" value={k.mrr} format="compact" delta={`${pct(k.mrrDeltaPct)} vs Sep`} tone={tone(k.mrrDeltaPct)} />
          <StatTile index={2} label="Collected this month" value={k.collected} format="compact" delta={`${pct(k.collectedDeltaPct)} vs Sep so far`} tone={tone(k.collectedDeltaPct)} />
          <StatTile index={3} label="Outstanding" value={k.outstanding} format="compact" delta={`${k.openCount} open invoices`} />
          <StatTile index={4} label="Overdue" value={k.overdueAmount} format="compact" delta={`${k.overdueCount} invoices`} tone={k.overdueCount ? "bad" : "neutral"} />
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
            <AgeingBars buckets={ageing} className="my-auto gap-5" />
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
              <Timeline events={events} />
            </ScrollPanel>
          </section>
        </div>
      </div>
    </PageGrid>
  );
}
