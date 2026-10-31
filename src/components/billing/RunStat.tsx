"use client";

import { animate, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { formatMoney, formatMoneyCompact, formatNumber } from "@/lib/format";
import { surface } from "@/lib/ui";

type Format = "number" | "money" | "compact";

const fmt = (format: Format, n: number) =>
  format === "money" ? formatMoney(Math.round(n)) : format === "compact" ? formatMoneyCompact(n) : formatNumber(Math.round(n));

/** Counts up from 0 on mount, then tweens from the value on screen whenever `value` changes. */
function LiveNumber({ value, format }: { value: number; format: Format }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(from.current, value, {
      duration: 0.5,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return <span className="tabular-nums">{fmt(format, reduce ? value : shown)}</span>;
}

type Props = {
  label: string;
  value: number;
  format?: Format;
  delta?: ReactNode;
  tone?: "good" | "neutral";
  /** Stagger index for the entrance animation. */
  index?: number;
};

/** Run-summary tile for the billing run: the StatTile look, but the number follows the run live instead of recounting from 0. */
export function RunStat({ label, value, format = "number", delta, tone = "neutral", index = 0 }: Props) {
  return (
    <div className={cn(surface, "animate-rise p-4")} style={{ animationDelay: `${index * 60}ms` }}>
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1.5 text-[22px] leading-7 font-medium tracking-tight text-text">
        <LiveNumber value={value} format={format} />
      </p>
      <p className={cn("mt-1 truncate text-[12px] tabular-nums", tone === "good" ? "text-[#34d399]" : "text-muted")}>
        {delta ?? "\u00a0"}
      </p>
    </div>
  );
}
