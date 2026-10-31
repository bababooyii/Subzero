"use client";

import { Banknote, CircleCheck, Receipt } from "lucide-react";
import { useState } from "react";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import { toast } from "@/components/ui/toast";
import { formatDate, formatMoney } from "@/lib/format";
import { TODAY_ISO } from "@/lib/mock/clock";
import type { InvoiceRow } from "@/lib/mock/selectors-billing";
import { btnPrimary, btnSecondary, btnSquare } from "@/lib/ui";
import { PaymentDialog } from "./PaymentDialog";
import type { PayableInvoice } from "@/components/payments/RecordPaymentDialog";

const columns: TableColumn<InvoiceRow>[] = [
  {
    accessorKey: "number",
    header: "Number",
    cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span>,
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => <span className="block max-w-[260px] truncate">{row.original.customer}</span>,
  },
  {
    accessorKey: "issueDate",
    header: "Issued",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted">{formatDate(row.original.issueDate)}</span>,
  },
  {
    accessorKey: "dueDate",
    header: "Due",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted">{formatDate(row.original.dueDate)}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        <StatusDot status={row.original.status} />
      </span>
    ),
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => formatMoney(row.original.total),
    meta: { align: "right", className: "whitespace-nowrap" },
  },
  {
    accessorKey: "balance",
    header: "Balance",
    cell: ({ row }) => (row.original.balance > 0 ? formatMoney(row.original.balance) : <span className="text-muted">–</span>),
    meta: { align: "right", className: "whitespace-nowrap" },
  },
];

const canSend = (r: InvoiceRow) => r.status === "confirmed" || r.status === "partial" || r.status === "overdue";

/** Invoices list. Confirming and recording payments update this table locally (mock data is read-only). */
export function InvoiceTable({ rows, emptyTitle, emptySubtitle }: { rows: InvoiceRow[]; emptyTitle: string; emptySubtitle: string }) {
  const [edits, setEdits] = useState<Record<string, Partial<InvoiceRow>>>({});
  const [target, setTarget] = useState<PayableInvoice | null>(null);

  const data = rows.map((r) => (edits[r.id] ? { ...r, ...edits[r.id] } : r));
  const patch = (list: Record<string, Partial<InvoiceRow>>) => setEdits((e) => ({ ...e, ...list }));
  const unpatch = (ids: string[]) =>
    setEdits((e) => {
      const next = { ...e };
      ids.forEach((id) => delete next[id]);
      return next;
    });

  const confirm = (drafts: InvoiceRow[]) => {
    patch(
      Object.fromEntries(
        drafts.map((r) => [r.id, { status: r.dueDate < TODAY_ISO ? "overdue" : "confirmed", balance: r.total } as Partial<InvoiceRow>]),
      ),
    );
    toast.undo(`Confirmed ${drafts.length} ${drafts.length === 1 ? "invoice" : "invoices"}`, () => unpatch(drafts.map((r) => r.id)));
  };

  const recorded = (row: PayableInvoice, amount: number) => {
    const src = data.find((r) => r.id === row.id);
    if (!src) return;
    const balance = src.balance - amount;
    patch({ [row.id]: { balance, status: balance <= 0 ? "paid" : src.status === "overdue" ? "overdue" : "partial" } });
    toast.undo(`Recorded ${formatMoney(amount)} for ${row.number}`, () => unpatch([row.id]));
  };

  return (
    <>
      <DataTable
        aria-label="Invoices"
        data={data}
        columns={columns}
        getRowId={(r) => r.id}
        getRowHref={(r) => `/invoices/${r.id}`}
        selectable
        bulkBar={(selected, clear) => {
          const drafts = selected.filter((r) => r.status === "draft");
          const sendable = selected.filter(canSend);
          return (
            <>
              <button
                type="button"
                className={`${btnSecondary} h-7`}
                disabled={sendable.length === 0}
                onClick={() => {
                  toast(`Sent ${sendable.length} ${sendable.length === 1 ? "invoice" : "invoices"} to customers`);
                  clear();
                }}
              >
                Send{sendable.length ? ` (${sendable.length})` : ""}
              </button>
              <button
                type="button"
                className={`${btnPrimary} h-7`}
                disabled={drafts.length === 0}
                onClick={() => {
                  confirm(drafts);
                  clear();
                }}
              >
                Confirm{drafts.length ? ` (${drafts.length})` : ""}
              </button>
            </>
          );
        }}
        rowActions={(r) =>
          r.balance > 0 ? (
            <button
              type="button"
              className={btnSquare}
              aria-label={`Record payment for ${r.number}`}
              title="Record payment"
              onClick={() => setTarget({ id: r.id, number: r.number, customer: r.customer, balance: r.balance })}
            >
              <Banknote size={15} />
            </button>
          ) : null
        }
        initialSorting={[]}
        empty={{ icon: emptyTitle.startsWith("No") ? <CircleCheck /> : <Receipt />, title: emptyTitle, subtitle: emptySubtitle }}
      />
      <PaymentDialog invoice={target} onOpenChange={(o) => !o && setTarget(null)} onRecord={(p) => target && recorded(target, p.amount)} />
    </>
  );
}
