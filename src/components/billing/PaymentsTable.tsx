"use client";

import { CreditCard } from "lucide-react";
import Link from "next/link";
import { DataTable, type TableColumn, type TablePagingProp } from "@/components/ui/DataTable";
import type { PaymentListRow } from "@/features/payments/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { METHOD_LABEL } from "./draft";

const columns: TableColumn<PaymentListRow>[] = [
  {
    accessorKey: "paidOn",
    header: "Date",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted">{formatDate(row.original.paidOn)}</span>,
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
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => <span className="block max-w-[260px] truncate">{row.original.customerName}</span>,
  },
  {
    accessorKey: "method",
    header: "Method",
    enableSorting: false,
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
    enableSorting: false,
    cell: ({ row }) => <span className="block max-w-[240px] truncate text-muted">{row.original.note || "–"}</span>,
  },
];

export function PaymentsTable({ rows, paging }: { rows: PaymentListRow[]; paging: TablePagingProp }) {
  return (
    <DataTable
      aria-label="Payments"
      data={rows}
      columns={columns}
      paging={paging}
      getRowId={(r) => r.id}
      getRowHref={(r) => `/invoices/${r.invoiceId}`}
      empty={{ icon: <CreditCard />, title: "No payments", subtitle: "Payments you record show up here." }}
    />
  );
}
