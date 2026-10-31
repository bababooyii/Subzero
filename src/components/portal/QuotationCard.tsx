"use client";

import { Check, Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Signature } from "@/components/kitchen/Signature";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { StatusDot } from "@/components/ui/StatusDot";
import { toast } from "@/components/ui/toast";
import { formatDate, formatMoney } from "@/lib/format";
import { btnPrimary, btnSecondary, heroBody, heroFrame } from "@/lib/ui";
import { intervalNoun } from "./labels";
import type { PortalSub } from "./types";

type Props = { sub: PortalSub; signer: string; today: string; onAccept: () => void };

const SIGN_SECONDS = 2;

/**
 * The hero of the portal overview: a quotation waiting for the customer, in a hero card that fills its parent's height.
 * The signing box takes whatever height is left. Accepting draws the signature in, then confirms the subscription;
 * the card then stays in place in its signed state (same layout, so nothing moves).
 */
export function QuotationCard({ sub, signer, today, onAccept }: Props) {
  const [signing, setSigning] = useState(false);
  const accepted = sub.status !== "quotation";
  const validUntil = sub.quotationValidUntil ?? sub.expiryDate;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function accept() {
    setSigning(true);
    timer.current = setTimeout(onAccept, (SIGN_SECONDS + 0.8) * 1000);
  }

  return (
    <article className={`${heroFrame} flex h-full min-h-0 animate-rise flex-col`} aria-label={`Quotation ${sub.number}`}>
      <div className={`${heroBody} flex min-h-0 flex-1 flex-col p-4`}>
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-medium text-text">{sub.planName}</h3>
            <p className="mt-0.5 text-[12px] text-muted">
              <span className="tabular-nums">{sub.number}</span> · Valid until {validUntil ? formatDate(validUntil) : "further notice"}
            </p>
          </div>
          {accepted ? <StatusDot status="active" label="Accepted" /> : <StatusDot status="quotation" />}
        </div>

        <ScrollPanel className="mt-3 shrink border-y border-white/[0.05]">
          <ul className="divide-y divide-white/[0.05] text-[13px]">
            {sub.lines.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-text">
                  {l.description}
                  {l.variant && !l.description.includes(l.variant) ? <span className="text-muted"> · {l.variant}</span> : null}
                  <span className="text-muted tabular-nums"> × {l.qty}</span>
                </span>
                <span className="shrink-0 text-muted tabular-nums">{formatMoney(l.amount)}</span>
              </li>
            ))}
          </ul>
        </ScrollPanel>
        <div className="mt-2 flex shrink-0 items-baseline justify-between">
          <span className="text-[12px] text-muted">Total incl. tax, per {intervalNoun(sub.interval, sub.intervalCount)}</span>
          <span className="text-[22px] leading-7 font-medium tracking-tight text-text tabular-nums">{formatMoney(sub.amount)}</span>
        </div>

        {/* Signing box: takes all the remaining height (about 220px or more on a tall screen). */}
        <div className="relative mt-2 min-h-[48px] flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] text-text [@media(min-height:1000px)]:min-h-[220px]">
          <span aria-hidden="true" className="absolute bottom-5 left-5 text-[15px] leading-none text-muted/60">×</span>
          <span aria-hidden="true" className="absolute right-5 bottom-5 left-10 h-px bg-white/10" />
          <div className="absolute inset-0 flex items-center justify-center px-8 pt-1.5 pb-5">
            {signing || accepted ? (
              <Signature
                key="signing"
                size={220}
                strokeWidth={9}
                duration={SIGN_SECONDS}
                className="h-full! max-h-[240px]! w-auto!"
                ariaLabel={`Signature of ${signer}`}
              />
            ) : (
              <span className="text-[13px] text-muted">Sign to accept</span>
            )}
          </div>
        </div>
        <p className="mt-1.5 shrink-0 truncate text-[12px] text-muted">
          {accepted ? `Signed by ${signer} · ${formatDate(today)}` : `Signing as ${signer}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-1.5 px-3 py-2.5">
        {accepted ? (
          <>
            <button type="button" className={btnSecondary} onClick={() => toast(`A copy of ${sub.number} was downloaded.`)}>
              <Download size={13} strokeWidth={2.5} aria-hidden="true" /> Download copy
            </button>
            <Link href={`/portal/subscriptions/${sub.id}`} className={btnPrimary}>
              View subscription
            </Link>
          </>
        ) : (
          <>
            <span className="pl-1 text-[12px] text-muted">{signing ? "Signing…" : "Your signature confirms this quotation."}</span>
            <button type="button" className={btnPrimary} disabled={signing} onClick={accept}>
              <Check size={14} strokeWidth={3} aria-hidden="true" />
              {signing ? "Signing…" : "Accept quotation"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
