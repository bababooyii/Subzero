"use client";

import { Ban, Banknote, Check, Printer, Receipt, Send } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { ScrambleText } from "@/components/kitchen/ScrambleText";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { StatusDot, type StatusKey } from "@/components/ui/StatusDot";
import { Timeline, type TimelineEvent } from "@/components/ui/Timeline";
import { toast } from "@/components/ui/toast";
import { cn } from "@/helpers/classname-helper";
import { formatDate, formatMoney, formatPeriod } from "@/lib/format";
import { TODAY, TODAY_ISO } from "@/lib/mock/clock";
import type { InvoiceDetail, PaymentRow } from "@/lib/mock/selectors-billing";
import type { InvoiceStatus } from "@/lib/mock/types";
import { btnPrimary, btnSecondary, heroBody, heroFrame, sectionTitle, surface } from "@/lib/ui";
import { METHOD_LABEL } from "./draft";
import { InvoiceDocument } from "./InvoiceDocument";
import { InvoiceStepper } from "./InvoiceStepper";
import { type NewPayment, PaymentDialog } from "./PaymentDialog";

/** Record page for one invoice (design-adaptation §5). Actions change local state only. */
export function InvoiceView({ detail }: { detail: InvoiceDetail }) {
  const [status, setStatus] = useState<InvoiceStatus>(detail.status);
  const [paid, setPaid] = useState(detail.amountPaid);
  const [payments, setPayments] = useState<PaymentRow[]>(detail.payments);
  const [events, setEvents] = useState<TimelineEvent[]>(detail.events);
  const [sent, setSent] = useState(detail.status !== "draft");
  const [paying, setPaying] = useState(false);

  const open = status === "confirmed";
  const balance = open ? Math.max(0, detail.total - paid) : 0;
  const overdue = open && balance > 0 && detail.dueDate < TODAY_ISO;
  const display: StatusKey = overdue ? "overdue" : open && paid > 0 && balance > 0 ? "partial" : status;
  const lastPaid = payments[0]?.date;

  const log = (text: string) => setEvents((e) => [{ id: `local-${e.length}`, at: TODAY.toISOString(), text }, ...e]);

  const confirmInvoice = () => {
    setStatus("confirmed");
    log(`Invoice ${detail.number} confirmed by you`);
    toast.undo(`Confirmed ${detail.number}`, () => {
      setStatus("draft");
      setSent(false);
      setEvents((e) => e.slice(1));
    });
  };

  const sendInvoice = () => {
    setSent(true);
    log(`Invoice ${detail.number} sent to ${detail.customer.email || detail.customer.name}`);
    toast(`Sent ${detail.number} to ${detail.customer.email || detail.customer.name}`);
  };

  const recordPayment = (p: NewPayment) => {
    const prev = { status, paid, payments, events };
    const nextPaid = paid + p.amount;
    const row: PaymentRow = {
      id: `local-pay-${payments.length}`,
      date: p.date,
      invoiceId: detail.id,
      invoiceNumber: detail.number,
      customerId: detail.customer.id,
      customer: detail.customer.name,
      method: p.method,
      amount: p.amount,
      note: p.note,
    };
    setPaid(nextPaid);
    setPayments([row, ...payments]);
    if (nextPaid >= detail.total) setStatus("paid");
    log(`Payment of ${formatMoney(p.amount)} received via ${METHOD_LABEL[p.method]}`);
    toast.undo(`Recorded ${formatMoney(p.amount)} for ${detail.number}`, () => {
      setStatus(prev.status);
      setPaid(prev.paid);
      setPayments(prev.payments);
      setEvents(prev.events);
    });
  };

  const cancelInvoice = () => {
    setStatus("cancelled");
    log(`Invoice ${detail.number} cancelled by you`);
    toast(`Cancelled ${detail.number}`);
  };

  const canCancel = (status === "draft" || status === "confirmed") && paid === 0;
  const primary =
    status === "draft"
      ? { label: "Confirm invoice", icon: <Check size={14} strokeWidth={3} />, run: confirmInvoice }
      : open && !sent
        ? { label: "Send invoice", icon: <Send size={14} />, run: sendInvoice }
        : open && balance > 0
          ? { label: "Record payment", icon: <Banknote size={14} />, run: () => setPaying(true) }
          : null;

  const facts: [string, ReactNode][] = [
    [
      "Customer",
      <Link key="c" href={`/customers/${detail.customer.id}`} className="hover:underline">
        {detail.customer.name}
      </Link>,
    ],
    ...(detail.subscription
      ? ([
          [
            "Subscription",
            <Link key="s" href={`/subscriptions/${detail.subscription.id}`} className="tabular-nums hover:underline">
              {detail.subscription.number}
            </Link>,
          ],
        ] as [string, ReactNode][])
      : []),
    ["Billing period", formatPeriod(detail.periodStart, detail.periodEnd)],
    ["Issued", formatDate(detail.issueDate)],
    ["Due", formatDate(detail.dueDate) + (detail.subscription ? ` · ${detail.subscription.paymentTerms}` : "")],
  ];

  return (
    <PageGrid
      left={
        <>
          <Intro icon={<Receipt />} title={<ScrambleText>{detail.number}</ScrambleText>} subtitle={<StatusDot status={display} strong />} />
          {open && sent && balance > 0 && primary?.label !== "Send invoice" ? (
            <button type="button" className={btnSecondary} onClick={sendInvoice}>
              <Send size={14} /> Resend
            </button>
          ) : null}
          <Link href={`/invoices/${detail.id}/print`} target="_blank" className={btnSecondary}>
            <Printer size={14} /> Print
          </Link>
          {canCancel ? (
            <ConfirmButton
              title={`Cancel ${detail.number}?`}
              description="The invoice is voided and can't be paid or reopened."
              confirmLabel={<><Ban size={13} /> Cancel invoice</>}
              onConfirm={cancelInvoice}
            >
              <Ban size={14} /> Cancel
            </ConfirmButton>
          ) : null}
          {primary ? (
            <button type="button" className={btnPrimary} onClick={primary.run}>
              {primary.icon} {primary.label}
            </button>
          ) : null}
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <InvoiceStepper
            status={status}
            extra={status === "cancelled" ? "cancelled" : display === "overdue" || display === "partial" ? display : undefined}
            className="shrink-0 animate-rise"
          />

          <section
            aria-label="Invoice preview"
            className={cn(heroFrame, "flex min-h-[240px] min-w-0 flex-1 animate-rise flex-col")}
            style={{ animationDelay: "60ms" }}
          >
            <div className={cn(heroBody, "flex min-h-0 flex-1 flex-col")}>
              <ScrollPanel className="flex-1 rounded-[26px] p-3 sm:p-6">
                <InvoiceDocument
                  data={{
                    number: detail.number,
                    status,
                    customer: detail.customer,
                    subscriptionNumber: detail.subscription?.number,
                    planName: detail.subscription?.planName,
                    paymentTerms: detail.subscription?.paymentTerms,
                    periodStart: detail.periodStart,
                    periodEnd: detail.periodEnd,
                    issueDate: detail.issueDate,
                    dueDate: detail.dueDate,
                    lines: detail.lines,
                    subtotal: detail.subtotal,
                    discountTotal: detail.discountTotal,
                    taxTotal: detail.taxTotal,
                    total: detail.total,
                    amountPaid: paid,
                    balance,
                    paidOn: lastPaid,
                  }}
                />
              </ScrollPanel>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
              <span className="text-[12px] text-muted">Preview of the printable invoice</span>
              <Link href={`/invoices/${detail.id}/print`} target="_blank" className={cn(btnSecondary, "h-7")}>
                <Printer size={13} /> Open print view
              </Link>
            </div>
          </section>

          <div
            className={cn(surface, "grid shrink-0 animate-rise grid-cols-2 gap-x-6 gap-y-3 px-5 py-3 sm:grid-cols-4")}
            style={{ animationDelay: "100ms" }}
            aria-label="Totals"
          >
            <TotalCell label="Total" value={formatMoney(detail.total)} />
            <TotalCell label="Received" value={formatMoney(paid)} />
            <TotalCell label="Balance due" value={status === "draft" || status === "cancelled" ? "–" : formatMoney(balance)} strong />
            <TotalCell label="Due" value={formatDate(detail.dueDate)} />
          </div>
        </div>

        <aside aria-label="Invoice facts" className="flex min-h-0 min-w-0 flex-col gap-4">
          <section className={cn(surface, "shrink-0 animate-rise p-4")} style={{ animationDelay: "40ms" }}>
            <h2 className={cn(sectionTitle, "mb-1")}>Details</h2>
            <dl className="divide-y divide-white/[0.05]">
              {facts.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-[12px] text-muted">{k}</dt>
                  <dd className="min-w-0 text-right text-[13px] text-text tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={cn(surface, "shrink-0 animate-rise p-4")} style={{ animationDelay: "120ms" }}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className={sectionTitle}>Payments</h2>
              {open && balance > 0 && primary?.label !== "Record payment" ? (
                <button type="button" className={cn(btnSecondary, "h-7")} onClick={() => setPaying(true)}>
                  <Banknote size={13} /> Record
                </button>
              ) : null}
            </div>
            {payments.length === 0 ? (
              <p className="text-[13px] text-muted">No payments yet.</p>
            ) : (
              <ScrollPanel className="max-h-36">
                <ul className="divide-y divide-white/[0.05]">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                      <span className="min-w-0">
                        <span className="block text-text">{METHOD_LABEL[p.method]}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {formatDate(p.date)}
                          {p.note ? ` · ${p.note}` : ""}
                        </span>
                      </span>
                      <span className="text-text tabular-nums">{formatMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </ScrollPanel>
            )}
          </section>

          <section className={cn(surface, "flex min-h-[120px] flex-1 animate-rise flex-col pt-4")} style={{ animationDelay: "180ms" }}>
            <h2 className={cn(sectionTitle, "mb-3 shrink-0 px-4")}>Activity</h2>
            <ScrollPanel className="min-h-0 flex-1 px-4 pb-4">
              <Timeline events={events} />
            </ScrollPanel>
          </section>
        </aside>
      </div>

      <PaymentDialog
        invoice={paying ? { id: detail.id, number: detail.number, customer: detail.customer.name, balance } : null}
        onOpenChange={(o) => !o && setPaying(false)}
        onRecord={recordPayment}
      />
    </PageGrid>
  );
}

function TotalCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cn("mt-0.5 truncate tabular-nums", strong ? "text-[17px] font-medium text-text" : "text-[15px] text-text")}>{value}</p>
    </div>
  );
}
