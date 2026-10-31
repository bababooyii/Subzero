"use client";

import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { Stepper } from "@/components/ui/Stepper";
import { StatusDot } from "@/components/ui/StatusDot";
import { Timeline, type TimelineEvent } from "@/components/ui/Timeline";
import { formatDate, formatMoney } from "@/lib/format";
import { sectionTitle, surface } from "@/lib/ui";
import { InvoiceStatus } from "./InvoiceStatus";
import { intervalNoun } from "./labels";
import { usePortal } from "./PortalProvider";
import { SubActions } from "./SubActions";
import type { PortalLine } from "./types";

const lineColumns: TableColumn<PortalLine>[] = [
  {
    accessorKey: "description",
    header: "Product",
    enableSorting: false,
    cell: ({ row }) => <span className="block max-w-[260px] truncate font-medium text-text">{row.original.description}</span>,
  },
  {
    accessorKey: "variant",
    header: "Variant",
    enableSorting: false,
    cell: ({ row }) => (row.original.variant ? <span className="text-muted">{row.original.variant}</span> : <span className="text-muted/50">—</span>),
  },
  { accessorKey: "qty", header: "Qty", meta: { align: "right" } },
  { accessorKey: "unitPrice", header: "Unit price", cell: ({ row }) => formatMoney(row.original.unitPrice), meta: { align: "right" } },
  { accessorKey: "taxRate", header: "Tax", cell: ({ row }) => <span className="text-muted">{row.original.taxRate}%</span>, meta: { align: "right" } },
  { accessorKey: "amount", header: "Amount", cell: ({ row }) => formatMoney(row.original.amount), meta: { align: "right" } },
];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] break-words text-text">{children}</dd>
    </div>
  );
}

function TotalCell({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? "text-[17px] font-medium text-text" : "text-[15px] text-text"}`}>{formatMoney(value)}</p>
    </div>
  );
}

type Props = { id: string; events: TimelineEvent[] };

/** A customer's own subscription: the same two-column record as the staff app. */
export function PortalSubscriptionDetail({ id, events }: Props) {
  const { subs, invoices, pauseSub, resumeSub, cancelSub } = usePortal();
  const sub = subs.find((s) => s.id === id);
  const history = useMemo(
    () => invoices.filter((i) => i.subscriptionId === id).sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    [invoices, id],
  );
  if (!sub) return null;
  const { status, totals } = sub;
  const validUntil = status === "quotation" ? (sub.quotationValidUntil ?? sub.expiryDate) : sub.expiryDate;

  return (
    <PageGrid
      left={
        <>
          <Intro icon={<RefreshCw />} title={sub.number} subtitle={<StatusDot status={status} strong />} />
          <SubActions sub={sub} onPause={() => pauseSub(id)} onResume={() => resumeSub(id)} onCancel={() => cancelSub(id)} />
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <Stepper current={status} className="shrink-0" />

          <section className="flex min-h-0 shrink flex-col gap-2.5">
            <h2 className={`${sectionTitle} shrink-0`}>What is included</h2>
            <ScrollPanel className="min-h-0 rounded-2xl">
              <DataTable aria-label="Subscription lines" data={sub.lines} columns={lineColumns} getRowId={(r) => r.id} autoFit={false} pageSize={100} />
            </ScrollPanel>
          </section>

          <div className={`${surface} grid shrink-0 grid-cols-4 gap-6 px-5 py-3`} aria-label="Totals">
            <TotalCell label="Subtotal" value={totals.subtotal} />
            <TotalCell label="Discount" value={-totals.discountTotal} />
            <TotalCell label="Tax" value={totals.taxTotal} />
            <TotalCell label={`Total / ${intervalNoun(sub.interval, sub.intervalCount)}`} value={totals.total} strong />
          </div>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className={`${surface} shrink-0 p-4`}>
            <h2 className={`${sectionTitle} mb-1`}>Details</h2>
            <dl className="divide-y divide-white/[0.05]">
              <Fact label="Plan">{sub.planName}</Fact>
              <Fact label="Billed">Every {intervalNoun(sub.interval, sub.intervalCount)}</Fact>
              <Fact label="Started">{formatDate(sub.startDate)}</Fact>
              <Fact label="Next billing">{status === "active" && sub.nextBillingDate ? formatDate(sub.nextBillingDate) : "None scheduled"}</Fact>
              <Fact label="Valid until">{validUntil ? formatDate(validUntil) : "No expiry"}</Fact>
              <Fact label="Payment terms">{sub.paymentTerms}</Fact>
            </dl>
          </div>

          <section className={`${surface} flex min-h-0 flex-col pt-4`}>
            <h2 className={`${sectionTitle} mb-3 shrink-0 px-4`}>Invoice history</h2>
            <ScrollPanel className="min-h-0 px-4 pb-4">
              {history.length > 0 ? (
                <ul className="divide-y divide-white/[0.05] text-[13px]" aria-label="Invoice history">
                  {history.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-medium whitespace-nowrap text-text tabular-nums">{i.number}</p>
                        <p className="truncate text-[12px] text-muted">
                          {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="text-text tabular-nums">{formatMoney(i.balance > 0 ? i.balance : i.total)}</span>
                        <InvoiceStatus status={i.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">No invoices yet. The first one appears after the first billing date.</p>
              )}
              {events.length > 0 ? (
                <>
                  <h2 className={`${sectionTitle} mt-5 mb-3`}>Activity</h2>
                  <Timeline events={events} />
                </>
              ) : null}
            </ScrollPanel>
          </section>
        </aside>
      </div>
    </PageGrid>
  );
}
