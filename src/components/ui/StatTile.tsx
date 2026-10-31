import type { ReactNode } from "react";
import { cn } from "@/helpers/classname-helper";
import { surface } from "@/lib/ui";
import { CountUp, type CountFormat } from "./CountUp";

type Props = {
  label: string;
  value: number;
  format?: CountFormat;
  /** A 12px line under the value, e.g. "+4 this month". */
  delta?: ReactNode;
  /** Colour the delta: good (green), bad (red) or neutral muted. */
  tone?: "good" | "bad" | "neutral";
  className?: string;
  /** Stagger index for the entrance animation. */
  index?: number;
};

/** Recessed KPI tile. The value counts up on load. */
export function StatTile({ label, value, format = "number", delta, tone = "neutral", className, index = 0 }: Props) {
  return (
    <div
      className={cn(surface, "animate-rise p-4", className)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1.5 text-[22px] leading-7 font-medium tracking-tight text-text">
        <CountUp value={value} format={format} />
      </p>
      {delta ? (
        <p
          className={cn(
            "mt-1 text-[12px] tabular-nums",
            tone === "good" && "text-[#34d399]",
            tone === "bad" && "text-[#f43f5e]",
            tone === "neutral" && "text-muted",
          )}
        >
          {delta}
        </p>
      ) : null}
    </div>
  );
}
