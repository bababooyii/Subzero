"use client";

import { CheckCheck, RotateCcw, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ScrambleText } from "@/components/kitchen/ScrambleText";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import type { DraftInvoice } from "@/lib/mock/selectors-billing";
import { btnPrimary, btnSecondary, sectionTitle, surface } from "@/lib/ui";
import { DraftCard } from "./DraftCard";
import { DraftContextPanel } from "./DraftContextPanel";
import { EditDraftDialog } from "./EditDraftDialog";
import { RunStat } from "./RunStat";
import { lineDiscount, priceDraft } from "./draft";

const EXIT_MS = 300;
/** Gap between cards when confirming everything. A little longer than the exit so each card is on top before it flies. */
const STEP_MS = 340;

const totalOf = (list: DraftInvoice[]) => list.reduce((n, d) => n + priceDraft(d.lines).total, 0);

/** The billing run (adaptation §6): a stacked deck of draft invoices to approve, skip or edit. State is local only. */
export function BillingRun({ initial }: { initial: DraftInvoice[] }) {
  const [queue, setQueue] = useState(initial);
  const [confirmed, setConfirmed] = useState<DraftInvoice[]>([]);
  const [skipped, setSkipped] = useState<DraftInvoice[]>([]);
  const [leaving, setLeaving] = useState<{ id: string; dir: "left" | "right" } | null>(null);
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState<DraftInvoice | null>(null);

  // The queue is read from timer callbacks, so keep a ref that is always current.
  const queueRef = useRef(initial);
  const timers = useRef<number[]>([]);
  const approveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const commit = (next: DraftInvoice[]) => {
    queueRef.current = next;
    setQueue(next);
  };

  /** Put drafts back at the front of the deck, in their original order. */
  const restore = (drafts: DraftInvoice[]) => {
    const ids = new Set(drafts.map((d) => d.id));
    setConfirmed((c) => c.filter((d) => !ids.has(d.id)));
    setSkipped((s) => s.filter((d) => !ids.has(d.id)));
    commit([...drafts, ...queueRef.current.filter((d) => !ids.has(d.id))]);
  };

  const fly = (draft: DraftInvoice, dir: "left" | "right", then: () => void) => {
    setLeaving({ id: draft.id, dir });
    later(() => {
      setLeaving(null);
      commit(queueRef.current.filter((d) => d.id !== draft.id));
      then();
    }, EXIT_MS);
  };

  const approve = (draft: DraftInvoice, silent = false) => {
    fly(draft, "right", () => {
      setConfirmed((c) => [...c, draft]);
      if (!silent) {
        toast.undo(`Confirmed ${draft.invoiceNumber} for ${draft.customerName}`, () => restore([draft]));
      }
    });
  };

  const skip = (draft: DraftInvoice) => {
    fly(draft, "left", () => {
      setSkipped((s) => [...s, draft]);
      toast.undo(`Skipped ${draft.invoiceNumber} for ${draft.customerName}`, () => restore([draft]));
    });
  };

  const confirmAll = () => {
    const batch = queueRef.current;
    if (batch.length === 0 || running) return;
    setRunning(true);
    batch.forEach((d, i) => later(() => approve(d, true), i * STEP_MS));
    later(
      () => {
        setRunning(false);
        toast.undo(`Confirmed ${batch.length} invoices · ${formatMoney(totalOf(batch))}`, () => restore(batch));
      },
      (batch.length - 1) * STEP_MS + EXIT_MS + 20,
    );
  };

  const saveEdit = (next: DraftInvoice) => {
    commit(queueRef.current.map((d) => (d.id === next.id ? next : d)));
    toast(`Updated ${next.invoiceNumber}`);
  };

  const top = queue[0];
  const total = totalOf(queue);
  const discounts = queue.reduce((n, d) => n + d.lines.filter((l) => lineDiscount(l) > 0).length, 0);
  const handled = confirmed.length + skipped.length;
  const all = queue.length + handled;
  const busy = running || leaving !== null;
  const sum = (list: DraftInvoice[]) => list.reduce((n, d) => n + priceDraft(d.lines).total, 0);
  const tax = queue.reduce((n, d) => n + priceDraft(d.lines).taxTotal, 0);
  const discountSum = queue.reduce((n, d) => n + priceDraft(d.lines).discountTotal, 0);

  // The header band: the intro on the left, the actions in the toolbar on the right.
  const left = top ? (
    <>
      <Intro
        key="ready"
        icon={<Zap />}
        title={`${queue.length} ${queue.length === 1 ? "invoice" : "invoices"} ready to bill`}
        subtitle={
          <>
            <ScrambleText>{formatMoney(total)}</ScrambleText> total
            {discounts > 0 ? ` · ${discounts} ${discounts === 1 ? "discount" : "discounts"} applied` : ""}
            {handled > 0 ? ` · ${handled} of ${all} handled` : ""}
          </>
        }
      />
      <button type="button" className={btnPrimary} onClick={confirmAll} disabled={busy}>
        <CheckCheck size={14} strokeWidth={2.5} /> Confirm all
      </button>
    </>
  ) : (
    <>
      <Intro
        key="done"
        icon={<CheckCheck />}
        title="You're all caught up!"
        subtitle={
          all === 0
            ? "Nothing is due to bill today."
            : `${confirmed.length} confirmed${skipped.length ? ` · ${skipped.length} skipped` : ""} · ${formatMoney(totalOf(confirmed))}`
        }
      />
      {skipped.length > 0 ? (
        <button type="button" className={btnSecondary} onClick={() => restore(skipped)}>
          <RotateCcw size={13} strokeWidth={2.25} /> Restore {skipped.length} skipped
        </button>
      ) : null}
      <Link href={confirmed.length > 0 ? "/invoices?view=confirmed" : "/invoices"} className={btnPrimary}>
        {confirmed.length > 0 ? "View confirmed invoices" : "View invoices"}
      </Link>
    </>
  );

  return (
    <PageGrid left={left}>
      <div className="flex h-full min-h-0 flex-col gap-6">
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Run summary">
          <RunStat index={0} label="To bill" value={queue.length} delta={formatMoney(total)} />
          <RunStat
            index={1}
            label="Confirmed"
            value={confirmed.length}
            delta={confirmed.length > 0 ? formatMoney(sum(confirmed)) : "None yet"}
            tone={confirmed.length > 0 ? "good" : "neutral"}
          />
          <RunStat
            index={2}
            label="Skipped"
            value={skipped.length}
            delta={skipped.length > 0 ? `${formatMoney(sum(skipped))} still due` : "None"}
          />
          <RunStat
            index={3}
            label="Discounts applied"
            value={discounts}
            delta={discountSum > 0 ? `-${formatMoney(discountSum)}` : "None in this run"}
          />
          <RunStat index={4} label="Tax" value={tax} format="money" delta="On invoices to bill" />
        </div>

        {/* The draft invoice leads; the subscription context sits beside it at the same height. Below lg only the deck shows. */}
        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)] xl:gap-8">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            {top ? (
              <DraftCard
                draft={top}
                behind={queue.length - 1}
                leaving={leaving?.id === top.id ? leaving.dir : null}
                busy={busy}
                approveRef={approveRef}
                onApprove={() => approve(top)}
                onSkip={() => skip(top)}
                onEdit={() => setEditing(top)}
              />
            ) : (
              <Summary confirmed={confirmed} skipped={skipped} onRestore={(d) => restore([d])} />
            )}
          </div>

          <div className="hidden min-h-0 min-w-0 pt-5 lg:block">
            {top ? <DraftContextPanel key={top.id} draft={top} /> : null}
          </div>
        </div>
      </div>
      <EditDraftDialog draft={editing} onOpenChange={(o) => !o && setEditing(null)} onSave={saveEdit} />
    </PageGrid>
  );
}

function Summary({
  confirmed,
  skipped,
  onRestore,
}: {
  confirmed: DraftInvoice[];
  skipped: DraftInvoice[];
  onRestore: (d: DraftInvoice) => void;
}) {
  if (confirmed.length === 0 && skipped.length === 0) return null;
  return (
    <ScrollPanel className="w-full">
      <div className="space-y-6">
        {confirmed.length > 0 ? (
          <section className="animate-rise space-y-2.5">
            <h2 className={sectionTitle}>Confirmed this run</h2>
            <ul className={`${surface} divide-y divide-white/[0.05]`}>
              {confirmed.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate text-text">{d.customerName}</span>
                    <span className="block text-[12px] text-muted tabular-nums">{d.invoiceNumber}</span>
                  </span>
                  <span className="text-text tabular-nums">{formatMoney(priceDraft(d.lines).total)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {skipped.length > 0 ? (
          <section className="animate-rise space-y-2.5" style={{ animationDelay: "80ms" }}>
            <h2 className={sectionTitle}>Skipped, still due</h2>
            <ul className={`${surface} divide-y divide-white/[0.05]`}>
              {skipped.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block truncate text-text">{d.customerName}</span>
                    <span className="block text-[12px] text-muted tabular-nums">{d.subscriptionNumber}</span>
                  </span>
                  <button type="button" className={`${btnSecondary} h-7`} onClick={() => onRestore(d)}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </ScrollPanel>
  );
}
