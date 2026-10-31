"use client";

import { Users } from "lucide-react";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import { formatMoney } from "@/lib/format";
import type { CustomerListRow } from "@/app/(app)/customers/list-query";

const columns: TableColumn<CustomerListRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const sub = [row.original.company, row.original.phone].filter(Boolean).join(" · ");
      return (
        <span className="block max-w-[260px] leading-tight">
          <span className="block truncate font-medium text-text">{row.original.name}</span>
          {sub ? <span className="block truncate text-[12px] text-muted">{sub}</span> : null}
        </span>
      );
    },
  },
  { accessorKey: "email", header: "Email", cell: ({ row }) => <span className="text-muted">{row.original.email}</span> },
  { accessorKey: "activeSubscriptions", header: "Active subs", meta: { align: "right" } },
  {
    accessorKey: "outstanding",
    header: "Outstanding",
    cell: ({ row }) => (row.original.outstanding ? formatMoney(row.original.outstanding) : <span className="text-muted/50">—</span>),
    meta: { align: "right" },
  },
  {
    accessorKey: "overdue",
    header: "Overdue",
    cell: ({ row }) =>
      row.original.overdue ? <StatusDot status="overdue" label={formatMoney(row.original.overdue)} /> : <span className="text-muted/50">—</span>,
  },
];

type Props = {
  rows: CustomerListRow[];
  paging: { total: number; page: number; pageSize: number };
  emptyTitle?: string;
  emptySubtitle?: string;
};

export function CustomersTable({ rows, paging, emptyTitle = "No customers here", emptySubtitle = "Try another saved view." }: Props) {
  return (
    <DataTable
      aria-label="Customers"
      data={rows}
      columns={columns}
      paging={paging}
      getRowId={(r) => r.id}
      getRowHref={(r) => `/customers/${r.id}`}
      empty={{ icon: <Users />, title: emptyTitle, subtitle: emptySubtitle }}
    />
  );
}
