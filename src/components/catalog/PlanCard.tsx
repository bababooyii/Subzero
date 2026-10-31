"use client";

import { Check, Minus, Pencil, Sparkles } from "lucide-react";
import { cn } from "@/helpers/classname-helper";
import { formatDate, formatMoney, formatMoneyCompact } from "@/lib/format";
import { btnSecondary, raised, surface } from "@/lib/ui";
import { PLAN_FLAGS, type PlanData, type PlanStats, intervalLabel, intervalUnit } from "./catalog-utils";
import { HoldDelete } from "./HoldDelete";

type Props = {
  plan: PlanData;
  stats?: PlanStats;
  onEdit: () => void;
  onDelete: () => void;
};

const EMPTY: PlanStats = { active: 0, mrr: 0, share: 0, monthly: [] };

/** Monthly price for the "≈ per month" line on longer intervals. */
const perMonth = (p: PlanData) => (p.interval === "yearly" ? Math.round(p.price / 12) : null);

/**
 * A plan as a pricing card: price and rules at the top, the plan's traction (subscribers, MRR,
 * share, new subscriptions per month) filling the middle, actions pinned at the bottom.
 */
export function PlanCard({ plan, stats = EMPTY, onEdit, onDelete }: Props) {
  const yearly = plan.interval === "yearly";
  const monthly = perMonth(plan);
  const peak = Math.max(1, ...stats.monthly.map((m) => m.count));

  return (
    <article
      aria-label={`${plan.name} plan`}
      className={cn(
        surface,
        "flex h-full min-h-0 flex-col p-5 transition-colors duration-200 hover:bg-white/[0.045]",
        yearly && "bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
      )}
    >
      {/* Name, interval, best-value tag */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-medium text-text">{plan.name}</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {intervalLabel(plan.interval)} · min {plan.minQty} {plan.minQty === 1 ? "seat" : "seats"}
          </p>
        </div>
        {yearly ? (
          <span className={cn(raised, "inline-flex shrink-0 items-center gap-1 rounded-full py-1 pr-2.5 pl-2 text-[11px] font-medium")}>
            <Sparkles size={12} aria-hidden="true" className="text-[#fbbf24]" />
            <span className="bg-[linear-gradient(90deg,#ffffff,#b4b4b4)] bg-clip-text text-transparent">Best value</span>
          </span>
        ) : null}
      </div>

      {/* Price */}
      <p className="mt-4 text-[22px] leading-none font-medium tracking-tight text-text tabular-nums">
        {formatMoney(plan.price)}
        <span className="ml-1.5 text-[13px] font-normal tracking-normal text-muted">/ {intervalUnit(plan.interval)}</span>
      </p>
      <p className="mt-1.5 h-4 text-[12px] text-muted tabular-nums">
        {monthly !== null ? `≈ ${formatMoney(monthly)} a month, billed yearly` : `Billed ${intervalLabel(plan.interval).toLowerCase()}`}
      </p>

      {/* Traction */}
      <dl className="mt-4 grid shrink-0 grid-cols-3 gap-2 border-y border-white/[0.06] py-3">
        {[
          ["Active", String(stats.active)],
          ["MRR", formatMoneyCompact(stats.mrr)],
          ["Share", `${Math.round(stats.share * 100)}%`],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] text-muted">{k}</dt>
            <dd className="mt-0.5 truncate text-[13px] font-medium text-text tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {/* New subscriptions per month: fills whatever height the card has */}
      <div className="flex min-h-16 flex-1 flex-col pt-3">
        <p className="text-[11px] text-muted">New subscriptions · last 6 months</p>
        <div className="mt-2 flex min-h-0 flex-1 items-end gap-1.5" role="img" aria-label={stats.monthly.map((m) => `${m.label} ${m.count}`).join(", ")}>
          {stats.monthly.map((m, i) => (
            <div key={m.label} className="group flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end gap-1">
              <div className="relative flex min-h-0 w-full flex-1 items-end">
                <div
                  className={cn(
                    "relative w-full rounded-[4px] transition-colors duration-150",
                    i === stats.monthly.length - 1 ? "bg-white/60 group-hover:bg-white/80" : "bg-white/15 group-hover:bg-white/30",
                  )}
                  style={{ height: `${Math.max(4, (m.count / peak) * 100)}%` }}
                >
                  {/* Value on hover, floating just above the bar */}
                  <span
                    className={cn(
                      raised,
                      "pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 translate-y-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-text tabular-nums opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100",
                    )}
                  >
                    {m.count} new
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-muted tabular-nums transition-colors group-hover:text-text">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rules */}
      <ul className="mt-4 grid shrink-0 grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]" aria-label="Plan options">
        {PLAN_FLAGS.map((f) => {
          const on = plan[f.key];
          const Icon = on ? Check : Minus;
          return (
            <li key={f.key} title={f.description} className={cn("flex items-center gap-1.5", on ? "text-text" : "text-muted/50")}>
              <Icon size={13} strokeWidth={on ? 2.5 : 2} aria-hidden="true" className="shrink-0" />
              {f.label}
              <span className="sr-only">{on ? " (on)" : " (off)"}</span>
            </li>
          );
        })}
      </ul>

      {/* Availability + actions */}
      <div className="mt-4 flex shrink-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] text-muted tabular-nums">
          {plan.availableFrom ? formatDate(plan.availableFrom) : "Any time"} – {plan.availableTo ? formatDate(plan.availableTo) : "no end"}
        </span>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" className={btnSecondary} onClick={onEdit} aria-label={`Edit ${plan.name}`}>
            <Pencil size={13} aria-hidden="true" /> Edit
          </button>
          <HoldDelete label={plan.name} onConfirm={onDelete} />
        </div>
      </div>
    </article>
  );
}
