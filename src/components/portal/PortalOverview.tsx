"use client";

import { CircleCheck, House } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { PaymentsIcon } from "@/components/shell/icons";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { StatTile } from "@/components/ui/StatTile";
import { formatDate, formatMoney } from "@/lib/format";
import type { PortalInvoice } from "@/lib/mock/selectors-portal";
import { btnPrimary, btnSecondary, sectionTitle, surface } from "@/lib/ui";
import { outstanding as outstandingOf, paidThisYear, projectedCharges, recentlyPaid, unpaidInvoices, upcomingCharges } from "./derive";
import { InvoiceStatus } from "./InvoiceStatus";
import { usePortal } from "./PortalProvider";
import { QuotationCard } from "./QuotationCard";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const viewAll = "text-[12px] text-muted outline-none hover:text-text focus-visible:outline-2 focus-visible:outline-accent";
/** Short screens (800px tall) drop a row or a card so the rest keep their normal padding. */
const tallOnly = "[@media(max-height:900px)]:hidden";

/** A recessed card with a title row (and an optional "View all" link). The body is whatever you put in. */
function Card({ title, href, children, delay, className }: { title: string; href?: string; children: ReactNode; delay: number; className?: string }) {
  return (
    <section className={`${surface} flex min-h-0 animate-rise flex-col px-5 py-4 ${className ?? ""}`} style={{ animationDelay: `${delay}ms` }} aria-label={title}>
      <div className="mb-1 flex shrink-0 items-baseline justify-between gap-3">
        <h2 className={sectionTitle}>{title}</h2>
        {href ? (
          <Link href={href} className={viewAll}>
            View all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Rows keep their natural height, split by hairlines. */
const rows = "flex flex-col divide-y divide-white/[0.05] text-[13px]";
const row = "flex items-center justify-between gap-4 py-3";

function InvoiceRow({ invoice, onPay, className = "", detailed }: { invoice: PortalInvoice; onPay: () => void; className?: string; detailed?: boolean }) {
  const overdue = invoice.status === "overdue";
  return (
    <li className={`flex items-center gap-4 ${detailed ? "py-3" : "py-2"} ${className}`}>
      {detailed ? (
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text tabular-nums">{invoice.number}</p>
          <p className="truncate text-[12px] text-muted">
            {invoice.subscriptionNumber} · due {formatDate(invoice.dueDate)}
          </p>
        </div>
      ) : (
        <p className="min-w-0 flex-1 truncate">
          <span className="font-medium text-text tabular-nums">{invoice.number}</span>
          <span className="text-[12px] text-muted"> · due {formatDate(invoice.dueDate)}</span>
        </p>
      )}
      <InvoiceStatus status={invoice.status} />
      <span className="w-24 shrink-0 text-right text-text tabular-nums">{formatMoney(invoice.balance)}</span>
      <button type="button" className={overdue ? btnPrimary : btnSecondary} onClick={onPay}>
        Pay
      </button>
    </li>
  );
}

function BillingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-text">{children}</dd>
    </div>
  );
}

export function PortalOverview() {
  const { customer, contactName, subs, invoices, acceptQuotation, pay } = usePortal();

  // The quotation that was waiting when the page opened stays as the hero after it is signed; only a reload drops it.
  const [heroId] = useState(() => subs.find((s) => s.status === "quotation")?.id);
  const quotation = subs.find((s) => s.id === heroId);

  const unpaid = unpaidInvoices(invoices);
  const overdueCount = unpaid.filter((i) => i.status === "overdue").length;
  const owed = outstandingOf(invoices);
  const next = upcomingCharges(subs)[0];
  const charges = projectedCharges(subs, 90);
  const paid = recentlyPaid(invoices);
  const activeCount = subs.filter((s) => s.status === "active").length;
  const pausedCount = subs.filter((s) => s.status === "paused").length;

  return (
    <PageGrid
      left={
        <>
          <Intro
            icon={<House />}
            title="Overview"
            subtitle={
              owed > 0
                ? `${plural(activeCount, "active subscription")} · ${formatMoney(owed)} to pay${overdueCount ? `, ${overdueCount} overdue` : ""}`
                : `${plural(activeCount, "active subscription")} · everything is paid up`
            }
          />
          <Link href={owed > 0 ? "/portal/invoices?view=unpaid" : "/portal/invoices"} className={owed > 0 ? btnPrimary : btnSecondary}>
            {owed > 0 ? "Pay invoices" : "View invoices"}
          </Link>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile index={0} label="Active subscriptions" value={activeCount} delta={pausedCount ? `${pausedCount} paused` : `${plural(subs.length, "subscription")} in total`} />
          <StatTile
            index={1}
            label="Next payment"
            value={next?.amount ?? 0}
            format="money"
            delta={next ? `${formatDate(next.nextBillingDate)} · ${next.number}` : "Nothing scheduled"}
          />
          <StatTile
            index={2}
            label="Outstanding"
            value={owed}
            format="money"
            tone={overdueCount ? "bad" : owed ? "neutral" : "good"}
            delta={overdueCount ? `${overdueCount} overdue` : owed ? plural(unpaid.length, "open invoice") : "All paid up"}
          />
          <StatTile index={3} label="Paid this year" value={paidThisYear(invoices)} format="money" delta={plural(paid.length, "paid invoice")} />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] grid-rows-[minmax(0,1fr)] gap-4">
          {/* Needs your attention. With a quotation it is the hero (and stays, signed, after accepting) over a slim strip of unpaid invoices. */}
          <div className="flex min-h-0 min-w-0 flex-col gap-4" aria-label="Needs your attention">
            {quotation ? (
              <>
                <div className="min-h-0 flex-1">
                  <QuotationCard sub={quotation} signer={contactName} onAccept={() => acceptQuotation(quotation)} />
                </div>
                {unpaid.length > 0 ? (
                  <Card title="Unpaid invoices" href="/portal/invoices?view=unpaid" delay={240} className="shrink-0">
                    <ul className="divide-y divide-white/[0.05] text-[13px]">
                      {unpaid.slice(0, 2).map((i, n) => (
                        <InvoiceRow key={i.id} invoice={i} onPay={() => pay(i)} className={n === 1 ? tallOnly : ""} />
                      ))}
                    </ul>
                  </Card>
                ) : null}
              </>
            ) : unpaid.length > 0 ? (
              <section className={`${surface} flex min-h-0 flex-1 animate-rise flex-col px-5 py-4`} style={{ animationDelay: "240ms" }} aria-label="Unpaid invoices">
                <div className="flex shrink-0 items-baseline justify-between gap-3">
                  <h2 className={sectionTitle}>Unpaid invoices</h2>
                  <Link href="/portal/invoices?view=unpaid" className={viewAll}>
                    View all
                  </Link>
                </div>
                <p className="mt-3 text-[22px] leading-7 font-medium tracking-tight text-text tabular-nums">{formatMoney(owed)}</p>
                <p className="mt-1 mb-3 shrink-0 text-[12px] text-muted">
                  due across {plural(unpaid.length, "invoice")}
                  {overdueCount ? ` · ${overdueCount} overdue` : ""}
                </p>
                <ScrollPanel className="min-h-0 flex-1 border-t border-white/[0.05]">
                  <ul className="divide-y divide-white/[0.05] text-[13px]">
                    {unpaid.map((i) => (
                      <InvoiceRow key={i.id} invoice={i} onPay={() => pay(i)} detailed />
                    ))}
                  </ul>
                </ScrollPanel>
              </section>
            ) : (
              <section className={`${surface} grid min-h-0 flex-1 animate-rise place-items-center p-8`} aria-label="Needs your attention">
                <Intro centered icon={<CircleCheck />} title="You're all caught up!" subtitle="Nothing needs your attention." />
              </section>
            )}
          </div>

          {/* Upcoming charges takes the leftover height with real rows (the next 90 days); the other cards stay content-sized. */}
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <Card title="Upcoming charges" delay={300} className="flex-1">
              {charges.length > 0 ? (
                <ScrollPanel className="-mx-1 min-h-0 flex-1 px-1">
                  <ul className={rows}>
                    {charges.map((c) => (
                      <li key={c.key}>
                        <Link href={`/portal/subscriptions/${c.sub.id}`} className={`${row} rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-accent`}>
                          <div className="min-w-0">
                            <p className="truncate text-text">{c.sub.planName}</p>
                            <p className="text-[12px] text-muted tabular-nums">{formatDate(c.date)}</p>
                          </div>
                          <span className="shrink-0 text-text tabular-nums">{formatMoney(c.amount)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </ScrollPanel>
              ) : (
                <p className="py-3 text-[13px] text-muted">Nothing is scheduled to bill. Paused and closed subscriptions do not charge.</p>
              )}
            </Card>

            {paid.length > 0 ? (
              <Card title="Recently paid" href="/portal/invoices?view=paid" delay={360} className="shrink-0">
                <ul className={rows}>
                  {paid.slice(0, 3).map((i, n) => (
                    <li key={i.id} className={`${row} ${n === 2 ? tallOnly : ""}`}>
                      <div className="min-w-0">
                        <p className="truncate text-text tabular-nums">{i.number}</p>
                        <p className="text-[12px] text-muted tabular-nums">{formatDate(i.issueDate)}</p>
                      </div>
                      <span className="shrink-0 text-text tabular-nums">{formatMoney(i.total)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {/* Content-sized, never stretched. Hidden on screens too short to hold it next to the cards above. */}
            <section
              className={`${surface} hidden shrink-0 animate-rise flex-col px-5 py-4 [@media(min-height:1100px)]:flex`}
              style={{ animationDelay: "420ms" }}
              aria-label="Billing details"
            >
              <div className="mb-1 flex shrink-0 items-center justify-between gap-3">
                <h2 className={sectionTitle}>Billing details</h2>
                <Link href="/portal/account" className={`${btnSecondary} h-7 px-2`}>
                  Manage
                </Link>
              </div>
              <dl className="divide-y divide-white/[0.05] text-[13px]">
                <BillingRow label="Payment method">
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-white/[0.06] text-muted">
                      <PaymentsIcon size={14} />
                    </span>
                    UPI · sundaram@okhdfc
                  </span>
                </BillingRow>
                <BillingRow label="Billing email">{customer.email}</BillingRow>
                <BillingRow label="Billing address">
                  {customer.name}, {customer.city}
                </BillingRow>
                <BillingRow label="Next charge">
                  {next ? (
                    <span className="tabular-nums">
                      {formatDate(next.nextBillingDate)} · {formatMoney(next.amount)}
                    </span>
                  ) : (
                    "Nothing scheduled"
                  )}
                </BillingRow>
              </dl>
            </section>
          </div>
        </div>
      </div>
    </PageGrid>
  );
}
