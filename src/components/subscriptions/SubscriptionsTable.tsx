"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import { toast } from "@/components/ui/toast";
import { applySubscriptionAction } from "@/features/subscriptions/actions";
import type { SubscriptionListRow } from "@/features/subscriptions/queries";
import { formatDate, formatMoney } from "@/lib/format";
import type { SubscriptionStatus } from "@/server/state-machine/subscription";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const columns: TableColumn<SubscriptionListRow>[] = [
  {
    accessorKey: "number",
    header: "Number",
    cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span>,
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => <span className="block max-w-[240px] truncate">{row.original.customerName}</span>,
  },
  { accessorKey: "planName", header: "Plan", cell: ({ row }) => <span className="whitespace-nowrap text-muted">{row.original.planName}</span> },
  { accessorKey: "status", header: "Status", enableSorting: false, cell: ({ row }) => <StatusDot status={row.original.status} /> },
  {
    accessorKey: "nextInvoiceDate",
    header: "Next billing",
    cell: ({ row }) =>
      row.original.nextInvoiceDate ? (
        <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(row.original.nextInvoiceDate)}</span>
      ) : (
        <span className="text-muted/50">—</span>
      ),
  },
  { accessorKey: "recurringTotal", header: "MRR", cell: ({ row }) => formatMoney(row.original.recurringTotal), meta: { align: "right" } },
  {
    accessorKey: "startDate",
    header: "Start",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(row.original.startDate)}</span>,
  },
];

type Props = {
  rows: SubscriptionListRow[];
  paging: { total: number; page: number; pageSize: number };
  emptyTitle?: string;
  emptySubtitle?: string;
};

/** Subscriptions list (one server page). The bulk bar applies the real state-machine actions row by row. */
export function SubscriptionsTable({ rows, paging, emptyTitle = "No subscriptions here", emptySubtitle = "Try another saved view." }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  /** `undoAction` is the inverse transition, when one exists (send quotation ↔ revise). Confirm has none. */
  const move = async (
    selected: SubscriptionListRow[],
    from: SubscriptionStatus,
    action: "send_quotation" | "confirm",
    verb: string,
    clear: () => void,
    undoAction?: "revise",
  ) => {
    const hit = selected.filter((r) => r.status === from);
    if (hit.length === 0 || busy) return;
    setBusy(true);
    const done: SubscriptionListRow[] = [];
    let firstError: string | undefined;
    for (const r of hit) {
      const res = await applySubscriptionAction({ id: r.id, action });
      if (res.ok) done.push(r);
      else firstError ??= `${r.number}: ${res.error}`;
    }
    setBusy(false);
    clear();
    router.refresh();
    if (done.length === 0) {
      toast(firstError ?? "Nothing changed");
      return;
    }
    const skipped = selected.length - done.length;
    const label = done.length === 1 ? done[0].number : `${done.length} subscriptions`;
    const message = `${verb} ${label}${skipped ? ` · ${skipped} skipped` : ""}`;
    if (!undoAction) {
      toast(message);
      return;
    }
    toast.undo(message, async () => {
      for (const r of done) await applySubscriptionAction({ id: r.id, action: undoAction });
      router.refresh();
    });
  };

  return (
    <DataTable
      aria-label="Subscriptions"
      data={rows}
      columns={columns}
      paging={paging}
      selectable
      getRowId={(r) => r.id}
      getRowHref={(r) => `/subscriptions/${r.id}`}
      empty={{ icon: <FileText />, title: emptyTitle, subtitle: emptySubtitle }}
      bulkBar={(selected, clear) => {
        const drafts = selected.filter((r) => r.status === "draft").length;
        const quotes = selected.filter((r) => r.status === "quotation").length;
        return (
          <>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy || drafts === 0}
              onClick={() => move(selected, "draft", "send_quotation", "Sent quotation for", clear, "revise")}
            >
              Send quotation
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={busy || quotes === 0}
              onClick={() => move(selected, "quotation", "confirm", "Confirmed", clear)}
            >
              Confirm
            </button>
          </>
        );
      }}
    />
  );
}
