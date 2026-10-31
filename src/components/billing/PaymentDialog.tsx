"use client";

import { useState } from "react";
import type { PayableInvoice } from "@/components/payments/RecordPaymentDialog";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { formatMoney } from "@/lib/format";
import { TODAY_ISO } from "@/lib/mock/clock";
import type { PaymentMethod } from "@/lib/mock/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import { METHOD_LABEL } from "./draft";

export type NewPayment = { amount: number; method: PaymentMethod; date: string; note: string };

const METHODS = (Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: METHOD_LABEL[m] }));

type Props = {
  invoice: PayableInvoice | null;
  onOpenChange: (open: boolean) => void;
  /** Called with the entered payment (amount in paise) just before the dialog closes. */
  onRecord: (payment: NewPayment) => void;
};

function Form({
  invoice,
  onOpenChange,
  onRecord,
}: {
  invoice: PayableInvoice;
  onOpenChange: (open: boolean) => void;
  onRecord: (p: NewPayment) => void;
}) {
  const [amount, setAmount] = useState(String(invoice.balance / 100));
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [date, setDate] = useState(TODAY_ISO);
  const [note, setNote] = useState("");

  const paise = Math.round(Number(amount) * 100);
  const valid = paise > 0 && paise <= invoice.balance;

  return (
    <DialogContent
      title="Record payment"
      description={`${invoice.number} · ${invoice.customer} · ${formatMoney(invoice.balance)} due`}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button
            type="button"
            className={btnPrimary}
            disabled={!valid}
            onClick={() => {
              onRecord({ amount: paise, method, date, note: note.trim() });
              onOpenChange(false);
            }}
          >
            Record payment
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Method" htmlFor="pay-method">
          <Dropdown
            id="pay-method"
            className="w-full"
            value={method}
            onChange={(v) => setMethod(v as PaymentMethod)}
            options={METHODS}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Amount (₹)"
            htmlFor="pay-amount"
            hint={paise > invoice.balance ? "That is more than the balance due." : "Defaults to the balance due."}
          >
            <Input id="pay-amount" align="right" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="pay-date">
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Note" htmlFor="pay-note">
          <Input id="pay-note" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </DialogContent>
  );
}

/**
 * Record payment dialog (adaptation §8) that reports the payment back to the page, so local state can update.
 * Same fields and look as the shared `RecordPaymentDialog`, which only shows a toast.
 */
export function PaymentDialog({ invoice, onOpenChange, onRecord }: Props) {
  return (
    <Dialog open={invoice !== null} onOpenChange={onOpenChange}>
      {invoice ? <Form key={invoice.id} invoice={invoice} onOpenChange={onOpenChange} onRecord={onRecord} /> : null}
    </Dialog>
  );
}
