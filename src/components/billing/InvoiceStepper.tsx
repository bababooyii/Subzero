import { Check } from "lucide-react";
import { StatusDot, type StatusKey } from "@/components/ui/StatusDot";
import { cn } from "@/helpers/classname-helper";
import { raised, selected } from "@/lib/ui";

const STEPS = ["draft", "confirmed", "paid"] as const;
const LABEL = { draft: "Draft", confirmed: "Confirmed", paid: "Paid" } as const;

type Props = {
  status: "draft" | "confirmed" | "paid" | "cancelled";
  /** Extra state shown as a dot beside the stepper (partially paid, overdue, cancelled). */
  extra?: StatusKey;
  className?: string;
};

/** Invoice status stepper: Draft → Confirmed → Paid. Same look as the subscription stepper; a side state shows as a dot. */
export function InvoiceStepper({ status, extra, className }: Props) {
  const at = status === "cancelled" ? -1 : STEPS.indexOf(status);
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
      {extra ? <StatusDot status={extra} strong /> : null}
    </div>
  );
}
