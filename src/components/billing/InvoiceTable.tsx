"use client";

import { Banknote, CircleCheck, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecordPaymentDialog, type PayableInvoice } from "@/components/payments/RecordPaymentDialog";
import { DataTable, type TableColumn, type TablePagingProp } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import { toast } from "@/components/ui/toast";
import { bulkConfirmInvoicesAction, bulkSendInvoicesAction } from "@/features/invoices/actions";
import type { InvoiceRow } from "@/features/invoices/queries";
import { formatDate, formatMoney } from "@/lib/format";
import { btnPrimary, btnSecondary, btnSquare } from "@/lib/ui";
import { statusKeyOf } from "./invoice-types";

const columns: TableColumn<InvoiceRow>[] = [
  {
    accessorKey: "number",
    header: "Number",
    cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span>,
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => <span className="block max-w-[260px] truncate">{row.original.customerName}</span>,
  },
  {
    accessorKey: "issuedOn",
    header: "Issued",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted">{formatDate(row.original.issuedOn)}</span>,
  },
  {
    accessorKey: "dueDate",
    header: "Due",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted">{formatDate(row.original.dueDate)}</span>,
  },
  {
    accessorKey: "displayStatus",
    header: "Status",
    // The server can't sort by the derived status.
    enableSorting: false,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        <StatusDot status={statusKeyOf(row.original.displayStatus)} />
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
    cell: ({ row }) => (isOpen(row.original) ? formatMoney(row.original.balance) : <span className="text-muted">–</span>),
    meta: { align: "right", className: "whitespace-nowrap" },
  },
];

/** Only confirmed invoices carry a balance. */
const isOpen = (r: InvoiceRow) => r.status === "confirmed" && r.balance > 0;
const canSend = (r: InvoiceRow) => r.status === "confirmed";
const plural = (n: number) => `${n} ${n === 1 ? "invoice" : "invoices"}`;

/** Invoices list (server-paged). Confirm, send and record payment run through the invoice and payment actions, then the page refreshes. */
export function InvoiceTable({
  rows,
  paging,
  emptyTitle,
  emptySubtitle,
}: {
  rows: InvoiceRow[];
  paging: TablePagingProp;
  emptyTitle: string;
  emptySubtitle: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<PayableInvoice | null>(null);

  const bulk = async (kind: "confirm" | "send", list: InvoiceRow[], clear: () => void) => {
    const ids = list.map((r) => r.id);
    const res = kind === "confirm" ? await bulkConfirmInvoicesAction(ids) : await bulkSendInvoicesAction(ids);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    clear();
    const { done, failed } = res.data;
    const verb = kind === "confirm" ? "Confirmed" : "Sent";
    toast(
      failed.length > 0
        ? `${verb} ${plural(done.length)}, ${failed.length} failed: ${failed[0].error}`
        : kind === "confirm"
          ? `${verb} ${plural(done.length)}`
          : `${verb} ${plural(done.length)} to customers`,
    );
    router.refresh();
  };

  return (
    <>
      <DataTable
        aria-label="Invoices"
        data={rows}
        columns={columns}
        paging={paging}
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
                onClick={() => void bulk("send", sendable, clear)}
              >
                Send{sendable.length ? ` (${sendable.length})` : ""}
              </button>
              <button
                type="button"
                className={`${btnPrimary} h-7`}
                disabled={drafts.length === 0}
                onClick={() => void bulk("confirm", drafts, clear)}
              >
                Confirm{drafts.length ? ` (${drafts.length})` : ""}
              </button>
            </>
          );
        }}
        rowActions={(r) =>
          isOpen(r) ? (
            <button
              type="button"
              className={btnSquare}
              aria-label={`Record payment for ${r.number}`}
              title="Record payment"
              onClick={() => setTarget({ id: r.id, number: r.number, customer: r.customerName, balance: r.balance })}
            >
              <Banknote size={15} />
            </button>
          ) : null
        }
        empty={{ icon: emptyTitle.startsWith("No") ? <CircleCheck /> : <Receipt />, title: emptyTitle, subtitle: emptySubtitle }}
      />
      <RecordPaymentDialog invoice={target} onOpenChange={(o) => !o && setTarget(null)} />
    </>
  );
}
