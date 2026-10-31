"use client";

import { Receipt } from "lucide-react";
import { useMemo } from "react";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews } from "@/components/ui/SavedViews";
import { formatDate, formatMoney } from "@/lib/format";
import type { PortalInvoice } from "@/lib/mock/selectors-portal";
import { btnPrimary } from "@/lib/ui";
import { outstanding } from "./derive";
import { InvoiceStatus } from "./InvoiceStatus";
import { usePortal } from "./PortalProvider";
import { INVOICE_VIEWS, type InvoiceView } from "./views";

const LABEL: Record<InvoiceView, string> = { all: "All", unpaid: "Unpaid", overdue: "Overdue", paid: "Paid" };
const EMPTY: Record<InvoiceView, [string, string]> = {
  all: ["No invoices yet", "Your first invoice appears after the first billing date."],
  unpaid: ["Nothing to pay", "Everything is paid up."],
  overdue: ["No overdue invoices", "Everything is paid up."],
  paid: ["No paid invoices", "Paid invoices show up here."],
};

const matches = (i: PortalInvoice, v: InvoiceView) =>
  v === "all" ? true : v === "unpaid" ? i.balance > 0 : v === "overdue" ? i.status === "overdue" : i.status === "paid";

export function PortalInvoices({ view }: { view: InvoiceView }) {
  const { invoices, pay } = usePortal();

  const columns = useMemo<TableColumn<PortalInvoice>[]>(
    () => [
      { accessorKey: "number", header: "Invoice", cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span> },
      { accessorKey: "subscriptionNumber", header: "Subscription", cell: ({ row }) => <span className="whitespace-nowrap text-muted tabular-nums">{row.original.subscriptionNumber}</span> },
      { accessorKey: "issueDate", header: "Issued", cell: ({ row }) => <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(row.original.issueDate)}</span> },
      { accessorKey: "dueDate", header: "Due", cell: ({ row }) => <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(row.original.dueDate)}</span> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <InvoiceStatus status={row.original.status} /> },
      { accessorKey: "total", header: "Total", meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.total) },
      { accessorKey: "balance", header: "Balance", meta: { align: "right" }, cell: ({ row }) => (row.original.balance > 0 ? formatMoney(row.original.balance) : <span className="text-muted/50">—</span>) },
      {
        id: "pay",
        header: "",
        enableSorting: false,
        meta: { align: "right", className: "w-0 pl-0" },
        cell: ({ row }) =>
          row.original.balance > 0 ? (
            <button type="button" className={btnPrimary} onClick={() => pay(row.original)}>
              Pay
            </button>
          ) : null,
      },
    ],
    [pay],
  );

  const rows = useMemo(() => invoices.filter((i) => matches(i, view)), [invoices, view]);
  const count = (v: InvoiceView) => invoices.filter((i) => matches(i, v)).length;
  const owed = outstanding(invoices);
  const [emptyTitle, emptySubtitle] = EMPTY[view];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<Receipt />}
            title={`${rows.length} ${rows.length === 1 ? "invoice" : "invoices"}`}
            subtitle={owed > 0 ? `${formatMoney(owed)} outstanding` : "Everything is paid up."}
          />
          <SavedViews
            active={view}
            aria-label="Invoice views"
            views={INVOICE_VIEWS.map((v) => ({
              key: v,
              label: LABEL[v],
              href: v === "all" ? "/portal/invoices" : `/portal/invoices?view=${v}`,
              // Counts carry meaning only: what is unpaid and what is late.
              count: v === "unpaid" || v === "overdue" ? count(v) : undefined,
            }))}
          />
        </>
      }
    >
      <DataTable
        key={view}
        aria-label="Invoices"
        data={rows}
        columns={columns}
        getRowId={(i) => i.id}
        initialSorting={[{ id: "issueDate", desc: true }]}
        empty={{ icon: <Receipt />, title: emptyTitle, subtitle: emptySubtitle }}
      />
    </PageGrid>
  );
}
