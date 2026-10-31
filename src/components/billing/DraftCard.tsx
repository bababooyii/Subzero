"use client";

import { Check, Pencil, X } from "lucide-react";
import Link from "next/link";
import type { Ref } from "react";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { cn } from "@/helpers/classname-helper";
import { formatDate, formatMoney } from "@/lib/format";
import type { DraftInvoice } from "@/lib/mock/selectors-billing";
import { btnPrimary, btnSecondary, btnSquare, heroBody, heroFrame } from "@/lib/ui";
import { lineDiscount, lineGross, priceDraft } from "./draft";
import { periodLabel } from "./period";

type Props = {
  draft: DraftInvoice;
  /** Number of cards still behind this one, to draw the stacked deck. */
  behind: number;
  leaving: "left" | "right" | null;
  busy: boolean;
  approveRef?: Ref<HTMLButtonElement>;
  onApprove: () => void;
  onSkip: () => void;
  onEdit: () => void;
};

/** The top card of the billing-run deck: a draft invoice preview with Edit / skip / Approve (design-system "Hero card"). */
export function DraftCard({ draft, behind, leaving, busy, approveRef, onApprove, onSkip, onEdit }: Props) {
  const t = priceDraft(draft.lines);
  const exit = leaving
    ? { transform: `translateX(${leaving === "right" ? 115 : -115}%) rotate(${leaving === "right" ? 6 : -6}deg)`, opacity: 0 }
    : undefined;

  return (
    // A shrinkable column chain: on a short screen the line list scrolls inside the card instead of the card overflowing.
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col pt-5">
        {behind > 1 ? <div aria-hidden="true" className={cn(heroFrame, "absolute inset-x-7 top-0 h-12 opacity-50")} /> : null}
        {behind > 0 ? <div aria-hidden="true" className={cn(heroFrame, "absolute inset-x-3.5 top-2.5 h-12 opacity-80")} /> : null}

        <div key={draft.id} className="relative flex min-h-0 flex-1 animate-card-in flex-col">
          <article
            className={cn(heroFrame, "flex min-h-0 flex-1 flex-col transition-[transform,opacity] duration-300 ease-out")}
            style={exit}
            aria-label={`Draft invoice ${draft.invoiceNumber} for ${draft.customerName}`}
          >
            <div className={cn(heroBody, "flex min-h-0 flex-1 flex-col p-7")}>
              <header className="flex shrink-0 items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[12px] text-muted">Draft invoice</p>
                  <h2 className="mt-1 truncate text-lg font-medium tracking-tight text-text">{draft.customerName}</h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    <Link href={`/subscriptions/${draft.subscriptionId}`} className="tabular-nums hover:text-text">
                      {draft.subscriptionNumber}
                    </Link>
                    {" · "}
                    {draft.context.planName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[15px] font-medium text-text tabular-nums">{draft.invoiceNumber}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-[#6b6a66]" />
                    Draft
                  </p>
                </div>
              </header>

              <dl className="mt-6 grid shrink-0 grid-cols-3 gap-4 border-y border-white/[0.06] py-4 text-[13px]">
                <div className="min-w-0">
                  <dt className="text-[12px] text-muted">Bill to</dt>
                  <dd className="mt-1 truncate text-text">{draft.customerName}</dd>
                  <dd className="truncate text-[12px] text-muted">{draft.city}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[12px] text-muted">Billing period</dt>
                  <dd className="mt-1 text-text tabular-nums">{periodLabel(draft.periodStart, draft.periodEnd)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[12px] text-muted">Due</dt>
                  <dd className="mt-1 text-text tabular-nums">{formatDate(draft.dueDate)}</dd>
                  <dd className="text-[12px] text-muted">{draft.paymentTerms}</dd>
                </div>
              </dl>

              <div className="mt-5 grid shrink-0 grid-cols-[minmax(0,1fr)_56px_110px_56px_120px] gap-3 pb-2 text-[12px] text-muted">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit price</span>
                <span className="text-right">Tax</span>
                <span className="text-right">Amount</span>
              </div>
              <ScrollPanel className="min-h-0 flex-1 border-t border-white/[0.05]">
                <ul className="divide-y divide-white/[0.05]">
                  {draft.lines.map((l) => {
                    const off = lineDiscount(l);
                    return (
                      <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_56px_110px_56px_120px] items-start gap-3 py-3 text-[14px] tabular-nums">
                        <div className="min-w-0">
                          <p className="truncate text-text">{l.description}</p>
                          {off > 0 ? <p className="text-[12px] text-muted">{l.discountName} -{formatMoney(off)}</p> : null}
                        </div>
                        <span className="text-right text-muted">{l.qty}</span>
                        <span className="text-right text-muted">{formatMoney(l.unitPrice)}</span>
                        <span className="text-right text-muted">{l.taxRate}%</span>
                        <span className="text-right text-text">{formatMoney(lineGross(l))}</span>
                      </li>
                    );
                  })}
                </ul>
              </ScrollPanel>

              <dl className="mt-4 ml-auto w-full max-w-72 shrink-0 space-y-2 text-[13px] text-muted tabular-nums">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(t.subtotal)}</dd>
                </div>
                {t.discountTotal > 0 ? (
                  <div className="flex justify-between">
                    <dt>Discount</dt>
                    <dd>-{formatMoney(t.discountTotal)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt>Tax</dt>
                  <dd>{formatMoney(t.taxTotal)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-white/[0.06] pt-3 text-text">
                  <dt className="font-medium">Total</dt>
                  <dd className="text-[22px] font-medium tracking-tight">{formatMoney(t.total)}</dd>
                </div>
              </dl>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-1.5 px-4 py-3">
              <button type="button" className={btnSecondary} onClick={onEdit} disabled={busy}>
                <Pencil size={11} fill="currentColor" strokeWidth={1.5} className="text-muted" /> Edit
              </button>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={cn(btnSquare, "text-[#f43f5e] hover:text-[#f43f5e]")}
                  onClick={onSkip}
                  disabled={busy}
                  aria-label={`Skip ${draft.customerName} for this run`}
                  title="Skip for this run"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
                <button ref={approveRef} type="button" className={btnPrimary} onClick={onApprove} disabled={busy}>
                  <Check size={14} strokeWidth={3} /> Approve
                </button>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
