"use client";

import { Banknote, CircleCheck } from "lucide-react";
import { useState } from "react";
import { RecordPaymentDialog, type PayableInvoice } from "@/components/payments/RecordPaymentDialog";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import { formatDate, formatMoney } from "@/lib/format";
import { btnSquare, cellSub } from "@/lib/ui";

export type OverdueRow = { id: string; number: string; customer: string; dueDate: string; daysOverdue: number; balance: number };

const columns: TableColumn<OverdueRow>[] = [
  { accessorKey: "number", header: "Invoice", cell: ({ row }) => <span className="font-medium text-text tabular-nums">{row.original.number}</span> },
  { accessorKey: "customer", header: "Customer", cell: ({ row }) => <span className="block max-w-[260px] truncate">{row.original.customer}</span> },
  {
    accessorKey: "daysOverdue",
    header: "Due",
    cell: ({ row }) => (
      <span className="flex items-center gap-3">
        <span className={`${cellSub} tabular-nums`}>{formatDate(row.original.dueDate)}</span>
        <StatusDot status="overdue" label={`${row.original.daysOverdue}d late`} />
      </span>
    ),
  },
  { accessorKey: "balance", header: "Balance", cell: ({ row }) => formatMoney(row.original.balance), meta: { align: "right" } },
];

export function OverdueTable({ rows }: { rows: OverdueRow[] }) {
  const [target, setTarget] = useState<PayableInvoice | null>(null);
  return (
    <>
      <DataTable
        aria-label="Overdue invoices"
        // Match the Recent activity card beside it: fill the cell; auto-fit packs rows into it.
        className="h-full"
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/invoices/${r.id}`}
        initialSorting={[{ id: "daysOverdue", desc: true }]}
        empty={{ icon: <CircleCheck />, title: "No overdue invoices", subtitle: "Everything is paid up." }}
        rowActions={(r) => (
          <button
            type="button"
            className={btnSquare}
            aria-label={`Record payment for ${r.number}`}
            title="Record payment"
            onClick={() => setTarget({ id: r.id, number: r.number, customer: r.customer, balance: r.balance })}
          >
            <Banknote size={15} />
          </button>
        )}
      />
      <RecordPaymentDialog invoice={target} onOpenChange={(o) => !o && setTarget(null)} />
    </>
  );
}
