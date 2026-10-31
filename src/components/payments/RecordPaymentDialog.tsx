"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { METHOD_LABEL, PAYMENT_METHODS, type PaymentMethod } from "@/components/billing/draft";
import { useRole } from "@/components/shell/role";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { deletePaymentAction, recordPaymentAction } from "@/features/payments/actions";
import { todayIST } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { btnPrimary, btnSecondary } from "@/lib/ui";

export type PayableInvoice = { id: string; number: string; customer: string; balance: number };

type Props = {
  invoice: PayableInvoice | null;
  onOpenChange: (open: boolean) => void;
};

const METHODS = PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }));
const errorOf = (errors: Record<string, string[]>, key: string) => errors[key]?.[0];

function Form({ invoice, onOpenChange }: { invoice: PayableInvoice; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { role } = useRole();
  const [amount, setAmount] = useState(String(invoice.balance / 100));
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [date, setDate] = useState(todayIST);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const paise = Math.round(Number(amount) * 100);
  const valid = paise > 0 && paise <= invoice.balance;

  const record = async () => {
    setPending(true);
    setErrors({});
    const res = await recordPaymentAction({
      invoiceId: invoice.id,
      method,
      amount: paise,
      paidOn: date,
      note: note.trim() || null,
    });
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast(res.error);
      return;
    }
    onOpenChange(false);
    const id = res.data.id;
    const message = `Recorded ${formatMoney(paise)} for ${invoice.number}`;
    // Undo deletes the payment: admin only, and not once the payment has settled the invoice (it can't be reopened).
    if (role === "admin" && paise < invoice.balance) {
      toast.undo(message, async () => {
        const undone = await deletePaymentAction(id);
        toast(undone.ok ? `Removed the ${formatMoney(paise)} payment from ${invoice.number}` : undone.error);
        router.refresh();
      });
    } else {
      toast(message);
    }
    router.refresh();
  };

  return (
    <DialogContent
      title="Record payment"
      description={`${invoice.number} · ${invoice.customer} · ${formatMoney(invoice.balance)} due`}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={() => void record()} disabled={!valid || pending}>
            Record payment
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Method" htmlFor="pay-method" hint={errorOf(errors, "method")}>
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
            hint={errorOf(errors, "amount") ?? (paise > invoice.balance ? "That is more than the balance due." : "Defaults to the balance due.")}
          >
            <Input id="pay-amount" align="right" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Date" htmlFor="pay-date" hint={errorOf(errors, "paidOn")}>
            <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Note" htmlFor="pay-note" hint={errorOf(errors, "note")}>
          <Input id="pay-note" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </DialogContent>
  );
}

/**
 * Record payment dialog (adaptation §8). Records through `recordPaymentAction`, refreshes the page, and offers Undo
 * (`deletePaymentAction`) to admins. Pass `invoice={null}` to close.
 */
export function RecordPaymentDialog({ invoice, onOpenChange }: Props) {
  return (
    <Dialog open={invoice !== null} onOpenChange={onOpenChange}>
      {invoice ? <Form key={invoice.id} invoice={invoice} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}
