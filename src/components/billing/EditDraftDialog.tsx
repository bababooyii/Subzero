"use client";

import { useState } from "react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { formatMoney } from "@/lib/format";
import type { DraftInvoice } from "@/lib/mock/selectors-billing";
import { btnPrimary, btnSecondary, hint, surface } from "@/lib/ui";
import { lineGross, priceDraft } from "./draft";

type Props = {
  draft: DraftInvoice | null;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: DraftInvoice) => void;
};

function Form({
  draft,
  onOpenChange,
  onSave,
}: {
  draft: DraftInvoice;
  onOpenChange: (open: boolean) => void;
  onSave: (d: DraftInvoice) => void;
}) {
  const [rows, setRows] = useState(() => draft.lines.map((l) => ({ qty: String(l.qty), price: String(l.unitPrice / 100) })));

  const lines = draft.lines.map((l, i) => {
    const qty = Math.max(0, Number(rows[i].qty) || 0);
    const price = Math.max(0, Number(rows[i].price) || 0);
    return { ...l, qty, unitPrice: Math.round(price * 100) };
  });
  const totals = priceDraft(lines);
  const valid = lines.every((l) => l.qty > 0);

  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <DialogContent
      width={520}
      title={`Edit ${draft.invoiceNumber}`}
      description={`${draft.customerName} · ${draft.subscriptionNumber}`}
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button
            type="button"
            className={btnPrimary}
            disabled={!valid}
            onClick={() => {
              onSave({ ...draft, lines });
              onOpenChange(false);
            }}
          >
            Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <ul className="space-y-3">
          {lines.map((l, i) => (
            <li key={l.id} className="space-y-2">
              <p className="truncate text-[13px] font-medium text-text">{l.description}</p>
              <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-end gap-3">
                <Field label="Qty" htmlFor={`edit-qty-${i}`}>
                  <Input
                    id={`edit-qty-${i}`}
                    align="right"
                    inputMode="numeric"
                    value={rows[i].qty}
                    onChange={(e) => set(i, { qty: e.target.value })}
                  />
                </Field>
                <Field label="Unit price (₹)" htmlFor={`edit-price-${i}`}>
                  <Input
                    id={`edit-price-${i}`}
                    align="right"
                    inputMode="decimal"
                    value={rows[i].price}
                    onChange={(e) => set(i, { price: e.target.value })}
                  />
                </Field>
                <p className="h-8 min-w-20 text-right text-[13px] leading-8 text-text tabular-nums">{formatMoney(lineGross(l))}</p>
              </div>
              {l.discountName ? <p className={hint}>{l.discountName} applies to this line.</p> : null}
            </li>
          ))}
        </ul>
        <dl className={`${surface} space-y-1.5 p-3 text-[13px] tabular-nums`}>
          <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
          {totals.discountTotal > 0 ? <Row label="Discount" value={`-${formatMoney(totals.discountTotal)}`} /> : null}
          <Row label="Tax" value={formatMoney(totals.taxTotal)} />
          <div className="flex justify-between border-t border-white/[0.06] pt-2 font-medium text-text">
            <dt>Total</dt>
            <dd>{formatMoney(totals.total)}</dd>
          </div>
        </dl>
      </div>
    </DialogContent>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Edit a draft invoice from the billing run: quantities and unit prices, with live totals. */
export function EditDraftDialog({ draft, onOpenChange, onSave }: Props) {
  return (
    <Dialog open={draft !== null} onOpenChange={onOpenChange}>
      {draft ? <Form key={draft.id} draft={draft} onOpenChange={onOpenChange} onSave={onSave} /> : null}
    </Dialog>
  );
}
