"use client";

import { FileText, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { PillSwitch } from "@/components/ui/PillSwitch";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { StatTile } from "@/components/ui/StatTile";
import { StatusDot } from "@/components/ui/StatusDot";
import { Timeline } from "@/components/ui/Timeline";
import { formatDate, formatDateLong, formatMoney } from "@/lib/format";
import type { CustomerDetail, InvoiceRow, PaymentRow, SubscriptionRow } from "@/lib/mock/selectors-subscriptions";
import { btnPrimary, sectionTitle, surface } from "@/lib/ui";
import { METHOD_LABEL } from "@/components/subscriptions/labels";

const date = (iso: string) => <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(iso)}</span>;

const subColumns: TableColumn<SubscriptionRow>[] = [
  { accessorKey: "number", header: "Number", cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span> },
  { accessorKey: "plan", header: "Plan", cell: ({ row }) => <span className="whitespace-nowrap text-muted">{row.original.plan}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusDot status={row.original.status} /> },
  {
    id: "nextBilling",
    header: "Next billing",
    accessorFn: (r) => r.nextBillingDate ?? "",
    cell: ({ row }) => (row.original.nextBillingDate ? date(row.original.nextBillingDate) : <span className="text-muted/50">—</span>),
  },
  { accessorKey: "mrr", header: "MRR", cell: ({ row }) => formatMoney(row.original.mrr), meta: { align: "right" } },
];

const invoiceColumns: TableColumn<InvoiceRow>[] = [
  { accessorKey: "number", header: "Number", cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span> },
  { accessorKey: "issueDate", header: "Issued", cell: ({ row }) => date(row.original.issueDate) },
  { accessorKey: "dueDate", header: "Due", cell: ({ row }) => date(row.original.dueDate) },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusDot status={row.original.status} /> },
  { accessorKey: "total", header: "Total", cell: ({ row }) => formatMoney(row.original.total), meta: { align: "right" } },
  { accessorKey: "balance", header: "Balance", cell: ({ row }) => formatMoney(row.original.balance), meta: { align: "right" } },
];

const paymentColumns: TableColumn<PaymentRow>[] = [
  { accessorKey: "date", header: "Date", cell: ({ row }) => date(row.original.date) },
  { accessorKey: "invoiceNumber", header: "Invoice", cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.invoiceNumber}</span> },
  { accessorKey: "method", header: "Method", cell: ({ row }) => <span className="text-muted">{METHOD_LABEL[row.original.method]}</span> },
  { accessorKey: "amount", header: "Amount", cell: ({ row }) => formatMoney(row.original.amount), meta: { align: "right" } },
  { accessorKey: "note", header: "Note", cell: ({ row }) => <span className="text-muted">{row.original.note || "—"}</span> },
];

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] break-words text-text">{children}</dd>
    </div>
  );
}

type Tab = "subscriptions" | "invoices" | "payments";

export function CustomerRecord({ detail }: { detail: CustomerDetail }) {
  const [tab, setTab] = useState<Tab>("subscriptions");
  return (
    <PageGrid
      left={
        <>
          <Intro
            icon={<Users />}
            title={detail.name}
            subtitle={detail.overdue > 0 ? <StatusDot status="overdue" strong label={`${formatMoney(detail.overdue)} overdue`} /> : <StatusDot status="paid" strong label="Paid up" />}
          />
          <Link href={`/subscriptions/new?customer=${detail.id}`} className={btnPrimary}>
            <Plus size={14} strokeWidth={2.5} /> New subscription
          </Link>
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="grid shrink-0 grid-cols-3 gap-3">
            <StatTile index={0} label="Active subscriptions" value={detail.activeSubscriptions} />
            <StatTile index={1} label="Outstanding" value={detail.outstanding} format="compact" />
            <StatTile index={2} label="Overdue" value={detail.overdue} format="compact" tone={detail.overdue ? "bad" : "neutral"} delta={detail.overdue ? "Needs follow-up" : "Nothing late"} />
          </div>

          <PillSwitch
            aria-label="Customer records"
            className="shrink-0 self-start"
            value={tab}
            onChange={(k) => setTab(k as Tab)}
            options={[
              { key: "subscriptions", label: "Subscriptions", count: detail.subscriptions.length },
              { key: "invoices", label: "Invoices", count: detail.invoices.length },
              { key: "payments", label: "Payments", count: detail.payments.length },
            ]}
          />

          <div key={tab} className="min-h-0 flex-1 animate-content-in">
            {tab === "subscriptions" ? (
              <DataTable
                aria-label="Subscriptions"
                data={detail.subscriptions}
                columns={subColumns}
                getRowId={(r) => r.id}
                getRowHref={(r) => `/subscriptions/${r.id}`}
                empty={{ icon: <FileText />, title: "No subscriptions yet", subtitle: "Start one with the button at the top." }}
              />
            ) : tab === "invoices" ? (
              <DataTable
                aria-label="Invoices"
                data={detail.invoices}
                columns={invoiceColumns}
                getRowId={(r) => r.id}
                getRowHref={(r) => `/invoices/${r.id}`}
                empty={{ icon: <FileText />, title: "No invoices yet", subtitle: "They appear after the first billing run." }}
              />
            ) : (
              <DataTable
                aria-label="Payments"
                data={detail.payments}
                columns={paymentColumns}
                getRowId={(r) => r.id}
                getRowHref={(r) => `/invoices/${r.invoiceId}`}
                empty={{ icon: <FileText />, title: "No payments yet", subtitle: "Recorded payments show up here." }}
              />
            )}
          </div>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className={`${surface} shrink-0 p-4`}>
            <h2 className={`${sectionTitle} mb-1`}>Details</h2>
            <dl className="divide-y divide-white/[0.05]">
              <Fact label="Contact">{detail.contactName}</Fact>
              <Fact label="Email">
                <a href={`mailto:${detail.email}`} className="hover:underline">
                  {detail.email}
                </a>
              </Fact>
              <Fact label="Phone">{detail.phone}</Fact>
              <Fact label="City">{detail.city}</Fact>
              <Fact label="GSTIN">
                <span className="tabular-nums">{detail.gstin}</span>
              </Fact>
              <Fact label="Customer since">{formatDateLong(detail.createdAt)}</Fact>
            </dl>
          </div>

          <section className={`${surface} flex min-h-0 flex-1 flex-col pt-4`}>
            <h2 className={`${sectionTitle} mb-3 shrink-0 px-4`}>Activity</h2>
            <ScrollPanel className="min-h-0 flex-1 px-4 pb-4">
              <Timeline events={detail.events} />
            </ScrollPanel>
          </section>
        </aside>
      </div>
    </PageGrid>
  );
}
