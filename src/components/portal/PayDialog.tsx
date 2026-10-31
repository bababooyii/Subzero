"use client";

import { useEffect, useRef, useState } from "react";
import { ReceiptPrinter, type ReceiptPrinterStage } from "@/components/kitchen/ReceiptPrinter";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field } from "@/components/ui/Field";
import { formatDate, formatMoney } from "@/lib/format";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import type { PortalInvoice } from "./types";

const METHODS = [
  { value: "UPI", label: "UPI" },
  { value: "Card", label: "Credit or debit card" },
  { value: "Net banking", label: "Net banking" },
] as const;

type Props = {
  invoice: PortalInvoice | null;
  /** Server "today" (IST), printed on the receipt. */
  today: string;
  onClose: () => void;
  /** Called when the (demo) payment completes. */
  onPaid: (invoice: PortalInvoice, method: string) => void;
};

type Phase = "form" | ReceiptPrinterStage;

const PROCESSING_MS = 1500;
const PRINTING_MS = 2000;

/**
 * Demo checkout (TODO(backend): no customer payment action exists yet, so nothing is recorded server-side):
 * pick a method, pay, then the Kitchen receipt printer runs processing → printing → complete.
 */
export function PayDialog({ invoice, today, onClose, onPaid }: Props) {
  return (
    <Dialog open={invoice !== null} onOpenChange={(open) => !open && onClose()}>
      {invoice ? <PayBody key={invoice.id} invoice={invoice} today={today} onClose={onClose} onPaid={onPaid} /> : null}
    </Dialog>
  );
}

function PayBody({ invoice, today, onClose, onPaid }: { invoice: PortalInvoice; today: string; onClose: () => void; onPaid: Props["onPaid"] }) {
  const [phase, setPhase] = useState<Phase>("form");
  const [method, setMethod] = useState<string>(METHODS[0].value);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Amount is fixed at open: the table row flips to Paid when the payment completes.
  const [amount] = useState(invoice.balance);
  // A stable mock reference derived from the invoice number.
  const reference = `BL${invoice.number.replace(/\D/g, "")}${method.slice(0, 2).toUpperCase()}7F2A`;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  function pay() {
    setPhase("processing");
    timers.current.push(
      setTimeout(() => setPhase("printing"), PROCESSING_MS),
      setTimeout(() => {
        setPhase("complete");
        onPaid(invoice, method);
      }, PROCESSING_MS + PRINTING_MS),
    );
  }

  if (phase === "form") {
    return (
      <DialogContent
        title={`Pay ${invoice.number}`}
        description={`${invoice.subscriptionNumber} · due ${formatDate(invoice.dueDate)}`}
        footer={
          <>
            <DialogClose className={btnSecondary}>Cancel</DialogClose>
            <button type="button" className={btnPrimary} onClick={pay}>
              Pay {formatMoney(amount)}
            </button>
          </>
        }
      >
        <dl className="mb-4 space-y-2 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted">Invoice total</dt>
            <dd className="tabular-nums">{formatMoney(invoice.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Already paid</dt>
            <dd className="tabular-nums">{formatMoney(invoice.total - amount)}</dd>
          </div>
          <div className="flex justify-between border-t border-white/[0.06] pt-2 font-medium">
            <dt>Amount to pay</dt>
            <dd className="tabular-nums">{formatMoney(amount)}</dd>
          </div>
        </dl>
        <Field label="Payment method" htmlFor="pay-method" hint="This is a demo checkout. No money moves.">
          <Dropdown id="pay-method" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m.value, label: m.label }))} />
        </Field>
      </DialogContent>
    );
  }

  const stage: ReceiptPrinterStage = phase;
  return (
    <DialogContent
      title={stage === "complete" ? "Payment received" : "Processing payment"}
      description={`${invoice.number} · ${formatMoney(amount)} via ${method}`}
      width={460}
      footer={
        <>
          <span className="pl-1 text-[12px] text-muted">
            {stage === "complete" ? "Your invoice now shows as paid." : "Please keep this window open."}
          </span>
          <button type="button" className={btnPrimary} disabled={stage !== "complete"} onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <ReceiptPrinter.Root stage={stage} className="mx-auto">
        <ReceiptPrinter.Machine>
          <ReceiptPrinter.Header>
            <ReceiptPrinter.Status>
              {stage === "processing" ? "Processing payment" : stage === "printing" ? "Printing your receipt" : "Payment complete"}
            </ReceiptPrinter.Status>
          </ReceiptPrinter.Header>
          <ReceiptPrinter.Screen>
            <p className="text-[11px] tracking-wide uppercase opacity-70">Paying</p>
            <p className="text-[20px] font-medium tabular-nums">{formatMoney(amount)}</p>
          </ReceiptPrinter.Screen>
        </ReceiptPrinter.Machine>
        <ReceiptPrinter.Output className="h-[min(21rem,calc(100dvh-24rem))] min-h-40">
          <ReceiptPrinter.Paper className="text-[12px] leading-relaxed">
            <p className="text-center text-[13px] font-bold tracking-[0.1em]">BRIGHTLOOP</p>
            <p className="text-center opacity-70">Payment receipt</p>
            <div className="my-3 border-t border-dashed border-current opacity-40" />
            <Row k="Invoice" v={invoice.number} />
            <Row k="Subscription" v={invoice.subscriptionNumber} />
            <Row k="Date" v={formatDate(today)} />
            <Row k="Method" v={method} />
            <Row k="Reference" v={reference} />
            <div className="my-3 border-t border-dashed border-current opacity-40" />
            <Row k="Paid" v={formatMoney(amount)} strong />
            <div className="my-3 border-t border-dashed border-current opacity-40" />
            <p className="text-center">Thank you for your payment.</p>
          </ReceiptPrinter.Paper>
        </ReceiptPrinter.Output>
      </ReceiptPrinter.Root>
    </DialogContent>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-bold" : ""}`}>
      <span className="opacity-70">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}
