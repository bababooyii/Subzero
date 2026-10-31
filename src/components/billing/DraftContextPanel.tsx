import { ArrowUpRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { StatusDot } from "@/components/ui/StatusDot";
import { sectionTitle, surface } from "@/lib/ui";
import { formatDate, formatMoney } from "@/lib/format";
import type { DraftInvoice } from "@/lib/mock/selectors-billing";
import { INTERVAL_LABEL, METHOD_LABEL } from "./draft";
import { periodLabel } from "./period";

/** Right column of the billing run: the subscription behind the invoice and the customer's latest invoices. Plain content, no card (adaptation §6); scrolls inside its column. */
export function DraftContextPanel({ draft }: { draft: DraftInvoice }) {
  const c = draft.context;
  const facts: [string, string][] = [
    ["Plan", `${c.planName} · ${INTERVAL_LABEL[c.interval]}`],
    ["Billing period", periodLabel(draft.periodStart, draft.periodEnd)],
    ["Subscription since", formatDate(c.startDate)],
    ["Invoices issued", String(c.invoicesIssued)],
    [
      "Last payment",
      c.lastPayment
        ? `${formatMoney(c.lastPayment.amount)} via ${METHOD_LABEL[c.lastPayment.method]} · ${formatDate(c.lastPayment.date)}`
        : "None yet",
    ],
    ["Open balance", c.openBalance > 0 ? formatMoney(c.openBalance) : "Nothing open"],
  ];
  return (
    <aside className={`${surface} flex h-full min-h-0 animate-rise flex-col`} aria-label="Subscription context">
      <ScrollPanel className="min-h-0 flex-1 p-6">
        <div className="space-y-5">
          <div>
            <p className="text-[12px] text-muted">Subscription</p>
            <h2 className="mt-1 text-lg font-medium tracking-tight text-text">{draft.customerName}</h2>
            <p className="text-[12px] text-muted">{draft.city}</p>
          </div>
          {c.overdueCount > 0 ? (
            <p className="flex items-start gap-2 text-[13px] text-[#f43f5e]" role="alert">
              <TriangleAlert size={15} className="mt-px shrink-0" />
              <span>
                {formatMoney(c.overdueBalance)} overdue across {c.overdueCount} {c.overdueCount === 1 ? "invoice" : "invoices"}.
              </span>
            </p>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-white/[0.06] py-4 text-[13px]">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] text-muted">{k}</dt>
                <dd className="text-text tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <section aria-label="Recent invoices">
            <h3 className={`${sectionTitle} mb-1.5`}>Recent invoices</h3>
            {c.recentInvoices.length === 0 ? (
              <p className="text-[12px] text-muted">No invoices for this customer yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {c.recentInvoices.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                    <span className="min-w-0">
                      <Link href={`/invoices/${i.id}`} className="block text-text tabular-nums hover:underline">
                        {i.number}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                        {formatDate(i.issueDate)}
                        <span aria-hidden="true">·</span>
                        <StatusDot status={i.status} />
                      </span>
                    </span>
                    <span className="shrink-0 text-text tabular-nums">{formatMoney(i.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link
            href={`/subscriptions/${draft.subscriptionId}`}
            className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-text"
          >
            Open {draft.subscriptionNumber} <ArrowUpRight size={14} />
          </Link>
        </div>
      </ScrollPanel>
    </aside>
  );
}
