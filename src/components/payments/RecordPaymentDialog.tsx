"use client";

import { useState } from "react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { TODAY_ISO } from "@/lib/mock/clock";
import { formatMoney } from "@/lib/format";
import { btnPrimary, btnSecondary } from "@/lib/ui";

export type PayableInvoice = { id: string; number: string; customer: string; balance: number };

type Props = {
  invoice: PayableInvoice | null;
  onOpenChange: (open: boolean) => void;
};

function Form({ invoice, onOpenChange }: { invoice: PayableInvoice; onOpenChange: (open: boolean) => void }) {
  const [amount, setAmount] = useState(String(invoice.balance / 100));
  const [method, setMethod] = useState("upi");
  const [date, setDate] = useState(TODAY_ISO);
  const [note, setNote] = useState("");

  const record = () => {
    const paise = Math.round(Number(amount) * 100);
    onOpenChange(false);
    toast.undo(`Recorded ${formatMoney(paise || 0)} for ${invoice.number}`, () => {});
  };

  return (
    <DialogContent
      title="Record payment"
      description={`${invoice.number} · ${invoice.customer} · ${formatMoney(invoice.balance)} due`}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={record} disabled={!(Number(amount) > 0)}>
            Record payment
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Method" htmlFor="pay-method">
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" htmlFor="pay-amount" hint="Defaults to the balance due.">
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

/** Record payment dialog (adaptation §8). Mock only: shows an Undo toast. Pass `invoice={null}` to close. */
export function RecordPaymentDialog({ invoice, onOpenChange }: Props) {
  return (
    <Dialog open={invoice !== null} onOpenChange={onOpenChange}>
      {invoice ? <Form key={invoice.id} invoice={invoice} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}
