"use client";

import { Pause, Play, RefreshCw, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { ScrambleText } from "@/components/kitchen/ScrambleText";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { Stepper } from "@/components/ui/Stepper";
import { StatusDot } from "@/components/ui/StatusDot";
import { Timeline } from "@/components/ui/Timeline";
import { toast } from "@/components/ui/toast";
import { applySubscriptionAction } from "@/features/subscriptions/actions";
import { formatDate, formatDateLong, formatMoney } from "@/lib/format";
import { btnPrimary, btnSecondary, hint, sectionTitle, surface } from "@/lib/ui";
import type { SubscriptionAction } from "@/server/state-machine/subscription";
import type { InvoiceRow, SubscriptionDetail, SubscriptionLineRow } from "./rows";

const lineColumns: TableColumn<SubscriptionLineRow>[] = [
  {
    id: "product",
    header: "Product",
    enableSorting: false,
    cell: ({ row }) => <span className="block max-w-[260px] truncate font-medium text-text">{row.original.product}</span>,
  },
  {
    id: "variant",
    header: "Variant",
    enableSorting: false,
    cell: ({ row }) => (row.original.variant ? <span className="text-muted">{row.original.variant}</span> : <span className="text-muted/50">—</span>),
  },
  { accessorKey: "qty", header: "Qty", meta: { align: "right" } },
  { accessorKey: "unitPrice", header: "Unit price", cell: ({ row }) => formatMoney(row.original.unitPrice), meta: { align: "right" } },
  { accessorKey: "tax", header: "Taxes", cell: ({ row }) => <span className="whitespace-nowrap text-muted">{row.original.tax}</span> },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="inline-flex flex-col items-end leading-tight">
        <span>{formatMoney(row.original.amount)}</span>
        {row.original.discount > 0 ? <span className="text-[11px] text-muted">−{formatMoney(row.original.discount)} off</span> : null}
      </span>
    ),
    meta: { align: "right" },
  },
];

const invoiceColumns: TableColumn<InvoiceRow>[] = [
  { accessorKey: "number", header: "Invoice", cell: ({ row }) => <span className="font-medium whitespace-nowrap text-text tabular-nums">{row.original.number}</span> },
  {
    accessorKey: "issueDate",
    header: "Issued",
    cell: ({ row }) => <span className="whitespace-nowrap text-muted tabular-nums">{formatDate(row.original.issueDate)}</span>,
  },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusDot status={row.original.status} /> },
  { accessorKey: "total", header: "Total", cell: ({ row }) => formatMoney(row.original.total), meta: { align: "right" } },
  { accessorKey: "balance", header: "Balance", cell: ({ row }) => formatMoney(row.original.balance), meta: { align: "right" } },
];

/** The forward move shown as the white button: whichever of these the state machine offers. */
const FORWARD: SubscriptionAction[] = ["send_quotation", "confirm", "activate", "resume"];

/** Past-tense text for the toast. */
const DONE: Record<SubscriptionAction, string> = {
  send_quotation: "quotation sent",
  confirm: "confirmed",
  activate: "activated",
  pause: "paused",
  resume: "resumed",
  close: "closed",
  cancel: "cancelled",
  revise: "moved back to draft",
};

/** The action that reverses another one, for the Undo toast. Moves like confirm have none. */
const INVERSE: Partial<Record<SubscriptionAction, SubscriptionAction>> = {
  pause: "resume",
  resume: "pause",
  send_quotation: "revise",
  revise: "send_quotation",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-text">{children}</dd>
    </div>
  );
}

function TotalCell({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? "text-[17px] font-medium text-text" : "text-[15px] text-text"}`}>{formatMoney(value)}</p>
    </div>
  );
}

/** Subscription record. Buttons come from the state machine's `availableActions`; the server owns every move. */
export function SubscriptionRecord({ detail }: { detail: SubscriptionDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { plan, status } = detail;

  const run = (action: SubscriptionAction) =>
    startTransition(async () => {
      const res = await applySubscriptionAction({ id: detail.id, action });
      if (!res.ok) {
        toast(res.error);
        return;
      }
      router.refresh();
      const inverse = INVERSE[action];
      const message = `${detail.number} ${DONE[action]}`;
      if (!inverse) {
        toast(message);
        return;
      }
      toast.undo(message, async () => {
        const back = await applySubscriptionAction({ id: detail.id, action: inverse });
        if (!back.ok) toast(back.error);
        else router.refresh();
      });
    });

  const offered = (a: SubscriptionAction) => detail.actions.find((x) => x.action === a);
  const next = detail.actions.find((x) => FORWARD.includes(x.action));
  const canPause = !!offered("pause");
  const canRevise = !!offered("revise");
  const canClose = !!offered("close");
  const canCancel = !!offered("cancel");
  const events = detail.events;
  const hasNotes = status === "closed" || !plan.closable || ((status === "active" || status === "paused") && !plan.pausable);

  return (
    <PageGrid
      left={
        <>
          <Intro
            icon={<RefreshCw />}
            title={<ScrambleText>{detail.number}</ScrambleText>}
            subtitle={<StatusDot status={status} strong />}
          />
          {next ? (
            <button type="button" className={btnPrimary} disabled={pending} onClick={() => run(next.action)}>
              {next.action === "resume" ? <Play size={13} strokeWidth={2.5} /> : null}
              {next.label}
            </button>
          ) : null}
          {canPause ? (
            <button type="button" className={btnSecondary} disabled={pending} onClick={() => run("pause")}>
              <Pause size={13} /> Pause
            </button>
          ) : null}
          {canRevise ? (
            <button type="button" className={btnSecondary} disabled={pending} onClick={() => run("revise")}>
              <RotateCcw size={13} /> Revise
            </button>
          ) : null}
          {canClose ? (
            <ConfirmButton
              title={`Close ${detail.number}?`}
              description="Billing stops and the subscription can't be reopened."
              confirmLabel={<><XCircle size={13} /> Close subscription</>}
              disabled={pending}
              onConfirm={() => run("close")}
            >
              <XCircle size={14} /> Close
            </ConfirmButton>
          ) : null}
          {canCancel ? (
            <ConfirmButton
              title={`Cancel ${detail.number}?`}
              description="The subscription is closed and can't be reopened."
              confirmLabel={<><XCircle size={13} /> Cancel subscription</>}
              disabled={pending}
              onConfirm={() => run("cancel")}
            >
              <XCircle size={14} /> Cancel
            </ConfirmButton>
          ) : null}
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <Stepper current={status} className="shrink-0" />

          <section className="flex min-h-0 shrink flex-col gap-2.5">
            <h2 className={`${sectionTitle} shrink-0`}>Lines</h2>
            <ScrollPanel className="min-h-0 rounded-2xl">
              <DataTable
                aria-label="Subscription lines"
                data={detail.lines}
                columns={lineColumns}
                getRowId={(r) => r.id}
                autoFit={false}
                pageSize={100}
              />
            </ScrollPanel>
          </section>

          <div className={`${surface} grid shrink-0 grid-cols-4 gap-6 px-5 py-3`} aria-label="Totals">
            <TotalCell label="Subtotal" value={detail.totals.subtotal} />
            <TotalCell label="Discount" value={-detail.totals.discountTotal} />
            <TotalCell label="Tax" value={detail.totals.taxTotal} />
            <TotalCell label="Total" value={detail.totals.total} strong />
          </div>

          <section className="flex min-h-[232px] flex-1 flex-col gap-2.5">
            <h2 className={`${sectionTitle} shrink-0`}>Invoices</h2>
            <div className="min-h-0 flex-1">
              <DataTable
                aria-label="Linked invoices"
                data={detail.invoices}
                columns={invoiceColumns}
                getRowId={(r) => r.id}
                getRowHref={(r) => `/invoices/${r.id}`}
                empty={{ icon: <XCircle />, title: "No invoices yet", subtitle: "The first one is created in a billing run." }}
              />
            </div>
          </section>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className={`${surface} shrink-0 p-4`}>
            <h2 className={`${sectionTitle} mb-1`}>Details</h2>
            <dl className="divide-y divide-white/[0.05]">
              <Fact label="Customer">
                <Link href={`/customers/${detail.customer.id}`} className="hover:underline">
                  {detail.customer.name}
                </Link>
              </Fact>
              <Fact label="Plan">{plan.name}</Fact>
              <Fact label="Start">{formatDateLong(detail.startDate)}</Fact>
              <Fact label="Expiry">{detail.expiryDate ? formatDateLong(detail.expiryDate) : <span className="text-muted">—</span>}</Fact>
              <Fact label="Next billing">
                {status === "active" && detail.nextBillingDate ? formatDateLong(detail.nextBillingDate) : <span className="text-muted">—</span>}
              </Fact>
              <Fact label="Payment terms">{detail.paymentTerms}</Fact>
            </dl>
            {hasNotes ? (
              <div className="mt-3 space-y-1">
                {status === "closed" ? <p className={hint}>This subscription is closed. No further invoices will be created.</p> : null}
                {status !== "closed" && !plan.closable ? <p className={hint}>{plan.name} can’t be closed early.</p> : null}
                {(status === "active" || status === "paused") && !plan.pausable ? <p className={hint}>{plan.name} can’t be paused.</p> : null}
              </div>
            ) : null}
          </div>

          <section className={`${surface} flex min-h-0 flex-1 flex-col pt-4`}>
            <h2 className={`${sectionTitle} mb-3 shrink-0 px-4`}>Activity</h2>
            <ScrollPanel className="min-h-0 flex-1 px-4 pb-4">
              <Timeline events={events} />
            </ScrollPanel>
          </section>
        </aside>
      </div>
    </PageGrid>
  );
}
