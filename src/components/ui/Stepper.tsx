import { Check } from "lucide-react";
import { cn } from "@/helpers/classname-helper";
import { raised, selected } from "@/lib/ui";
import { StatusDot } from "./StatusDot";

const STEPS = ["draft", "quotation", "confirmed", "active", "closed"] as const;
const LABEL: Record<(typeof STEPS)[number], string> = {
  draft: "Draft",
  quotation: "Quotation",
  confirmed: "Confirmed",
  active: "Active",
  closed: "Closed",
};

type Props = {
  current: "draft" | "quotation" | "confirmed" | "active" | "paused" | "closed";
  className?: string;
};

/** Status stepper: Draft → Quotation → Confirmed → Active → Closed. Paused shows as an amber dot beside it. */
export function Stepper({ current, className }: Props) {
  const paused = current === "paused";
  const at = STEPS.indexOf(paused ? "active" : (current as (typeof STEPS)[number]));
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <ol className={cn("inline-flex max-w-full overflow-x-auto rounded-full p-1", raised)} aria-label="Status">
        {STEPS.map((step, i) => {
          const state = i < at ? "past" : i === at ? "current" : "future";
          return (
            <li
              key={step}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] whitespace-nowrap",
                state === "current" && selected,
                state === "past" && "text-muted",
                state === "future" && "text-muted/50",
              )}
            >
              {state === "past" ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
              {LABEL[step]}
            </li>
          );
        })}
      </ol>
      {paused ? <StatusDot status="paused" strong /> : null}
    </div>
  );
}
