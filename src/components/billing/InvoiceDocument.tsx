import { Check } from "lucide-react";
import { Stamp } from "@/components/kitchen/Stamp";
import { cn } from "@/helpers/classname-helper";
import { formatDateLong, formatMoney } from "@/lib/format";
import type { InvoiceLineView } from "@/lib/mock/selectors-billing";
import type { InvoiceStatus } from "@/lib/mock/types";

export type InvoiceDocData = {
  number: string;
  status: InvoiceStatus;
  customer: { name: string; contactName: string; email: string; city: string; gstin: string };
  subscriptionNumber?: string;
  planName?: string;
  paymentTerms?: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLineView[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  /** Date of the last payment, shown on the PAID stamp. */
  paidOn?: string;
};

/*
 * The printable invoice (adaptation §9). The only light surface in the app: --bg #FFFFFF, --text #1C1C1A,
 * --line #E6E5E1. Used for the on-screen preview and for /invoices/[id]/print.
 */
const INK = "text-[#1c1c1a]";
const MUTED = "text-[#6b6a66]";
const LINE = "border-[#e6e5e1]";

export function InvoiceDocument({ data, print = false }: { data: InvoiceDocData; print?: boolean }) {
  const paid = data.status === "paid";
  return (
    <article
      aria-label={`Invoice ${data.number}`}
      className={cn(
        "relative mx-auto bg-white font-sans text-[12px] leading-relaxed",
        INK,
        print
          ? "min-h-[297mm] w-[210mm] max-w-full p-[16mm] print:min-h-0 print:p-[14mm]"
          : "w-full max-w-[720px] min-w-[560px] rounded-md p-8 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] sm:p-10",
      )}
    >
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[16px] font-extrabold tracking-[0.025em] uppercase">Brightloop</p>
          <p className={cn("mt-1", MUTED)}>Brightloop Software</p>
          <p className={MUTED}>Bengaluru, Karnataka, India</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-medium tracking-tight">Invoice</p>
          <p className="tabular-nums">{data.number}</p>
          {data.status === "draft" || data.status === "cancelled" ? (
            <p className={cn("mt-1 text-[11px] font-medium tracking-wide uppercase", MUTED)}>{data.status}</p>
          ) : null}
        </div>
      </header>

      <div className={cn("mt-8 grid grid-cols-2 gap-6 border-t pt-6", LINE)}>
        <div>
          <p className={cn("mb-1 text-[11px] font-medium tracking-wide uppercase", MUTED)}>Bill to</p>
          <p className="text-[13px] font-medium">{data.customer.name}</p>
          {data.customer.contactName ? <p>{data.customer.contactName}</p> : null}
          {data.customer.email ? <p className={MUTED}>{data.customer.email}</p> : null}
          {data.customer.city ? <p className={MUTED}>{data.customer.city}</p> : null}
          {data.customer.gstin ? <p className={cn("tabular-nums", MUTED)}>GSTIN {data.customer.gstin}</p> : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-0.5 text-right">
          <dt className={MUTED}>Issued</dt>
          <dd className="tabular-nums">{formatDateLong(data.issueDate)}</dd>
          <dt className={MUTED}>Due</dt>
          <dd className="tabular-nums">{formatDateLong(data.dueDate)}</dd>
          <dt className={MUTED}>Billing period</dt>
          <dd className="tabular-nums">
            {formatDateLong(data.periodStart)} – {formatDateLong(data.periodEnd)}
          </dd>
          {data.subscriptionNumber ? (
            <>
              <dt className={MUTED}>Subscription</dt>
              <dd className="tabular-nums">
                {data.subscriptionNumber}
                {data.planName ? ` · ${data.planName}` : ""}
              </dd>
            </>
          ) : null}
          {data.paymentTerms ? (
            <>
              <dt className={MUTED}>Terms</dt>
              <dd>{data.paymentTerms}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <table className="mt-8 w-full border-collapse tabular-nums">
        <thead>
          <tr className={cn("border-b text-[11px] font-medium tracking-wide uppercase", LINE, MUTED)}>
            <th className="py-2 text-left font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Tax</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l) => (
            <tr key={l.id} className={cn("border-b align-top", LINE)}>
              <td className="py-2.5 pr-3">
                {l.description}
                {l.discount > 0 ? <span className={cn("block text-[11px]", MUTED)}>Discount -{formatMoney(l.discount)}</span> : null}
              </td>
              <td className="py-2.5 text-right">{l.qty}</td>
              <td className="py-2.5 text-right">{formatMoney(l.unitPrice)}</td>
              <td className={cn("py-2.5 text-right", MUTED)}>{l.taxRate}%</td>
              <td className="py-2.5 text-right">{formatMoney(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-start justify-between gap-6">
        {paid ? (
          <Stamp
            aria-label="Paid"
            className="pointer-events-none mt-3 ml-2 w-24 shrink-0 -rotate-[8deg] animate-pop"
            paper="#ecfdf5"
            ink="#047857"
            padding={7}
            horizontalPerforations={8}
            verticalPerforations={10}
          >
            <div className="grid size-full place-items-center rounded-[3px] border-2 border-current text-center">
              <div>
                <Check size={18} strokeWidth={3.5} className="mx-auto" aria-hidden="true" />
                <p className="text-[17px] leading-tight font-black tracking-widest">PAID</p>
                {data.paidOn ? <p className="text-[9px] font-medium tabular-nums">{formatDateLong(data.paidOn)}</p> : null}
              </div>
            </div>
          </Stamp>
        ) : null}
        <dl className="ml-auto w-64 space-y-1 tabular-nums">
          <Row label="Subtotal" value={formatMoney(data.subtotal)} />
          {data.discountTotal > 0 ? <Row label="Discount" value={`-${formatMoney(data.discountTotal)}`} /> : null}
          <Row label="Tax" value={formatMoney(data.taxTotal)} />
          <div className={cn("flex justify-between border-t pt-2 text-[14px] font-semibold", LINE)}>
            <dt>Total</dt>
            <dd>{formatMoney(data.total)}</dd>
          </div>
          {data.amountPaid > 0 ? <Row label="Paid" value={`-${formatMoney(data.amountPaid)}`} /> : null}
          {data.status !== "draft" && data.status !== "cancelled" ? (
            <div className="flex justify-between text-[13px] font-medium">
              <dt>Balance due</dt>
              <dd>{formatMoney(data.balance)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <p className={cn("mt-10 border-t pt-4 text-[11px]", LINE, MUTED)}>
        Thank you for your business. Please quote {data.number} with your payment. This is a computer-generated invoice.
      </p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className={MUTED}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
