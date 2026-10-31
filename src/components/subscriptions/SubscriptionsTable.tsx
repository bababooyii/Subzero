"use client";

import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import { toast } from "@/components/ui/toast";
import { formatDate, formatMoney } from "@/lib/format";
import type { SubscriptionRow } from "@/lib/mock/selectors-subscriptions";
import type { SubscriptionStatus } from "@/lib/mock/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";

const columns: TableColumn<SubscriptionRow>[] = [
  {
    accessorKey: "number",
    header: "Number",
    cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span>,
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => <span className="block max-w-[240px] truncate">{row.original.customer}</span>,
  },
  { accessorKey: "plan", header: "Plan", cell: ({ row }) => <span className="whitespace-nowrap text-muted">{row.original.plan}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusDot status={row.original.status} /> },
  {
    id: "nextBilling",
    header: "Next billing",
    accessorFn: (r) => r.nextBillingDate ?? "",
    cell: ({ row }) =>
      row.original.nextBillingDate ? (
        <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(row.original.nextBillingDate)}</span>
      ) : (
        <span className="text-muted/50">—</span>
      ),
  },
  { accessorKey: "mrr", header: "MRR", cell: ({ row }) => formatMoney(row.original.mrr), meta: { align: "right" } },
  {
    accessorKey: "startDate",
    header: "Start",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(row.original.startDate)}</span>,
  },
];

type Props = { rows: SubscriptionRow[]; emptyTitle?: string; emptySubtitle?: string };

/** Subscriptions list. Status changes from the bulk bar are local state only. */
export function SubscriptionsTable({ rows, emptyTitle = "No subscriptions here", emptySubtitle = "Try another saved view." }: Props) {
  const [overrides, setOverrides] = useState<Record<string, SubscriptionStatus>>({});
  const data = useMemo(
    () => rows.map((r) => (overrides[r.id] ? { ...r, status: overrides[r.id] } : r)),
    [rows, overrides],
  );

  const move = (selected: SubscriptionRow[], from: SubscriptionStatus, to: SubscriptionStatus, verb: string, clear: () => void) => {
    const hit = selected.filter((r) => r.status === from);
    if (hit.length === 0) return;
    setOverrides((o) => ({ ...o, ...Object.fromEntries(hit.map((r) => [r.id, to])) }));
    clear();
    const skipped = selected.length - hit.length;
    const label = hit.length === 1 ? hit[0].number : `${hit.length} subscriptions`;
    toast.undo(`${verb} ${label}${skipped ? ` · ${skipped} skipped` : ""}`, () =>
      setOverrides((o) => {
        const next = { ...o };
        for (const r of hit) delete next[r.id];
        return next;
      }),
    );
  };

  return (
    <DataTable
      aria-label="Subscriptions"
      data={data}
      columns={columns}
      selectable
      getRowId={(r) => r.id}
      getRowHref={(r) => `/subscriptions/${r.id}`}
      initialSorting={[{ id: "number", desc: true }]}
      empty={{ icon: <FileText />, title: emptyTitle, subtitle: emptySubtitle }}
      bulkBar={(selected, clear) => {
        const drafts = selected.filter((r) => r.status === "draft").length;
        const quotes = selected.filter((r) => r.status === "quotation").length;
        return (
          <>
            <button
              type="button"
              className={btnSecondary}
              disabled={drafts === 0}
              onClick={() => move(selected, "draft", "quotation", "Sent quotation for", clear)}
            >
              Send quotation
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={quotes === 0}
              onClick={() => move(selected, "quotation", "confirmed", "Confirmed", clear)}
            >
              Confirm
            </button>
          </>
        );
      }}
    />
  );
}
