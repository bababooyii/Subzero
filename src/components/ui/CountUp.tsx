"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { formatMoney, formatMoneyCompact, formatNumber } from "@/lib/format";

export type CountFormat = "number" | "money" | "compact" | "percent";

function fmt(format: CountFormat, n: number) {
  switch (format) {
    case "money":
      return formatMoney(n);
    case "compact":
      return formatMoneyCompact(n);
    case "percent":
      return `${n.toFixed(1)}%`;
    default:
      return formatNumber(Math.round(n));
  }
}

type Props = { value: number; format?: CountFormat; className?: string; duration?: number };

/** A number that counts up from 0 on mount. Money values are integer paise. */
export function CountUp({ value, format = "number", className, duration = 0.9 }: Props) {
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const shown = reduce ? value : animated;

  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: setAnimated,
    });
    return () => controls.stop();
  }, [value, reduce, duration]);

  return <span className={className ? `${className} tabular-nums` : "tabular-nums"}>{fmt(format, shown)}</span>;
}
