"use client";

import { RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews } from "@/components/ui/SavedViews";
import { StatusDot } from "@/components/ui/StatusDot";
import { formatDate, formatMoney } from "@/lib/format";
import { intervalNoun } from "./labels";
import { usePortal } from "./PortalProvider";
import type { PortalSub } from "./types";
import { SUBSCRIPTION_VIEWS, type SubscriptionView } from "./views";

const LABEL: Record<SubscriptionView, string> = { all: "All", active: "Active", paused: "Paused", closed: "Closed" };
const EMPTY: Record<SubscriptionView, [string, string]> = {
  all: ["No subscriptions yet", "Subscriptions you accept show up here."],
  active: ["No active subscriptions", "Active subscriptions show up here."],
  paused: ["Nothing is paused", "Paused subscriptions land here."],
  closed: ["Nothing is closed", "Cancelled and expired subscriptions show up here."],
};

const columns: TableColumn<PortalSub>[] = [
  { accessorKey: "number", header: "Number", cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span> },
  { accessorKey: "planName", header: "Plan", cell: ({ row }) => <span className="whitespace-nowrap text-muted">{row.original.planName}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusDot status={row.original.status} /> },
  {
    id: "nextBilling",
    header: "Next billing",
    accessorFn: (s) => (s.status === "active" ? (s.nextBillingDate ?? "") : ""),
    cell: ({ row }) =>
      row.original.status === "active" && row.original.nextBillingDate ? (
        <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(row.original.nextBillingDate)}</span>
      ) : (
        <span className="text-muted/50">—</span>
      ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatMoney(row.original.amount)}
        <span className="text-muted"> / {intervalNoun(row.original.interval, row.original.intervalCount)}</span>
      </span>
    ),
  },
];

const matches = (s: PortalSub, v: SubscriptionView) => (v === "all" ? true : s.status === v);

export function PortalSubscriptions({ view }: { view: SubscriptionView }) {
  const { subs } = usePortal();
  const rows = useMemo(() => subs.filter((s) => matches(s, view)), [subs, view]);
  const count = (v: SubscriptionView) => subs.filter((s) => matches(s, v)).length;
  const summary = (["active", "paused", "closed"] as const)
    .filter((v) => count(v) > 0)
    .map((v) => `${count(v)} ${v}`)
    .join(" · ");
  const [emptyTitle, emptySubtitle] = EMPTY[view];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<RefreshCw />}
            title={`${rows.length} ${view === "all" ? (rows.length === 1 ? "subscription" : "subscriptions") : LABEL[view].toLowerCase()}`}
            subtitle={summary || "No subscriptions yet"}
          />
          <SavedViews
            aria-label="Subscription views"
            active={view}
            views={SUBSCRIPTION_VIEWS.map((v) => ({
              key: v,
              label: LABEL[v],
              href: v === "all" ? "/portal/subscriptions" : `/portal/subscriptions?view=${v}`,
            }))}
          />
        </>
      }
    >
      <DataTable
        key={view}
        aria-label="Subscriptions"
        data={rows}
        columns={columns}
        getRowId={(s) => s.id}
        getRowHref={(s) => `/portal/subscriptions/${s.id}`}
        initialSorting={[{ id: "number", desc: false }]}
        empty={{ icon: <RefreshCw />, title: emptyTitle, subtitle: emptySubtitle }}
      />
    </PageGrid>
  );
}
