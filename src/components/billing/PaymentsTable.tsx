"use client";

import { CreditCard } from "lucide-react";
import Link from "next/link";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { formatDate, formatMoney } from "@/lib/format";
import type { PaymentRow } from "@/lib/mock/selectors-billing";
import { METHOD_LABEL } from "./draft";

const columns: TableColumn<PaymentRow>[] = [
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted">{formatDate(row.original.date)}</span>,
  },
  {
    accessorKey: "invoiceNumber",
    header: "Invoice",
    cell: ({ row }) => (
      <Link
        href={`/invoices/${row.original.invoiceId}`}
        className="font-medium whitespace-nowrap text-text tabular-nums hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {row.original.invoiceNumber}
      </Link>
    ),
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => <span className="block max-w-[260px] truncate">{row.original.customer}</span>,
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted">{METHOD_LABEL[row.original.method]}</span>,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => formatMoney(row.original.amount),
    meta: { align: "right", className: "whitespace-nowrap" },
  },
  {
    accessorKey: "note",
    header: "Note",
    cell: ({ row }) => <span className="block max-w-[240px] truncate text-muted">{row.original.note || "–"}</span>,
  },
];

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  return (
    <DataTable
      aria-label="Payments"
      data={rows}
      columns={columns}
      getRowId={(r) => r.id}
      getRowHref={(r) => `/invoices/${r.invoiceId}`}
      initialSorting={[{ id: "date", desc: true }]}
      empty={{ icon: <CreditCard />, title: "No payments", subtitle: "Payments you record show up here." }}
    />
  );
}
