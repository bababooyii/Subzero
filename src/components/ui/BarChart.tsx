"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { raised } from "@/lib/ui";
import { cn } from "@/helpers/classname-helper";

export type BarDatum = {
  /** Short axis label. */
  label: string;
  value: number;
  secondary?: number;
  /** Tooltip heading when the axis label is abbreviated (e.g. the full date range). Defaults to `label`. */
  detail?: string;
};

type Props = {
  data: BarDatum[];
  /** Label for the primary series in the tooltip. */
  seriesLabel: string;
  secondaryLabel?: string;
  /** Fixed pixel height. Omit to fill the parent's height (the parent needs a definite height). */
  height?: number;
  className?: string;
};

const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

function niceMax(v: number) {
  if (v <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x) ?? 10) * pow;
}

/** Width and height of an element, kept current with a ResizeObserver. `null` until first measured. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * Single-series bar chart in off-white with 5% white grid lines.
 * Values are integer paise. Hover or focus a bar for a raised tooltip.
 * Draws at the size of its box (1 unit = 1px), so it fills a card of any height without distorting text.
 */
export function BarChart({ data, seriesLabel, secondaryLabel, height: fixedHeight, className }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const [box, size] = useSize<HTMLDivElement>();
  // Exactly the measured box: never larger, or the chart would spill out of its card.
  const W = Math.max(size?.w ?? 0, PAD.left + PAD.right + 1);
  const height = Math.max(fixedHeight ?? size?.h ?? 0, PAD.top + PAD.bottom + 1);
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(44, slot * 0.5);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const a = active === null ? null : data[active];

  return (
    <div ref={box} className={cn("relative w-full overflow-hidden", fixedHeight ? undefined : "h-full min-h-0", className)} style={fixedHeight ? { height: fixedHeight } : undefined}>
      {size ? (
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="absolute top-0 left-0 block max-h-full max-w-full" role="img" aria-label={`${seriesLabel} by period`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(max * t)} y2={y(max * t)} stroke="rgba(255,255,255,0.05)" />
            <text x={PAD.left - 8} y={y(max * t) + 3.5} textAnchor="end" fontSize="11" fill="#9a9994" className="tabular-nums">
              {formatMoneyCompact(max * t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          const h = Math.max(2, (d.value / max) * innerH);
          const on = active === i;
          return (
            <g
              key={d.label}
              tabIndex={0}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none"
              aria-label={`${d.detail ?? d.label}: ${formatMoney(d.value)}`}
            >
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill={on ? "rgba(255,255,255,0.04)" : "transparent"} rx="8" />
              <rect
                x={x}
                y={PAD.top + innerH - h}
                width={barW}
                height={h}
                rx="5"
                fill="#ececea"
                opacity={on || active === null ? 1 : 0.55}
                className="origin-bottom animate-[rise_0.6s_cubic-bezier(.2,.8,.2,1)_both] transition-opacity"
                style={{ animationDelay: `${i * 60}ms` }}
              />
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="12" fill={on ? "#ececea" : "#9a9994"}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      ) : null}
      {a ? (
        <div
          className={cn("pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-xl px-3 py-2 text-[12px]", raised)}
          // Keep the tooltip (about 160px wide) inside the box at the first and last bars.
          style={{ left: Math.min(Math.max(PAD.left + slot * (active ?? 0) + slot / 2, 84), Math.max(84, W - 84)) }}
        >
          <p className="font-medium text-text">{a.detail ?? a.label}</p>
          <p className="text-muted tabular-nums">
            {seriesLabel} <span className="text-text">{formatMoney(a.value)}</span>
          </p>
          {a.secondary !== undefined && secondaryLabel ? (
            <p className="text-muted tabular-nums">
              {secondaryLabel} <span className="text-text">{formatMoney(a.secondary)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
