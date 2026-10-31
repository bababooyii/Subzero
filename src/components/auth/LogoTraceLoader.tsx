"use client";

import { cn } from "@/helpers/classname-helper";

/** The Brightloop mark: one continuous loop (an infinity-style ribbon). */
const VIEW_BOX = "0 0 48 48";
const TRACE_PATH =
  "M24 24 C 29 15, 42 15, 42 24 C 42 33, 29 33, 24 24 C 19 15, 6 15, 6 24 C 6 33, 19 33, 24 24 Z";

type Props = {
  size?: number;
  strokeWidth?: number;
  loopDurationSeconds?: number;
  className?: string;
  ariaLabel?: string;
};

/**
 * Small traced-logo loader (see docs/kitchen/LogoTraceLoader.prompt.md): a short stroke segment runs
 * around the mark while work is in flight, over a faint full outline. Uses currentColor.
 * With reduced motion the full outline is shown, static.
 */
export function LogoTraceLoader({
  size = 18,
  strokeWidth = 5,
  loopDurationSeconds = 1.1,
  className,
  ariaLabel = "Loading",
}: Props) {
  return (
    <svg
      role="status"
      aria-label={ariaLabel}
      viewBox={VIEW_BOX}
      width={size}
      height={size}
      className={cn("block shrink-0 overflow-visible", className)}
    >
      <path
        d={TRACE_PATH}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.22}
        strokeWidth={Math.max(2, strokeWidth / 2)}
        strokeLinejoin="round"
      />
      <path
        className="logo-trace-segment"
        d={TRACE_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="0.18 0.82"
        style={{ animationDuration: `${loopDurationSeconds}s` }}
      />
      <style>{`
        .logo-trace-segment {
          animation-name: logo-trace-loop;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes logo-trace-loop {
          to { stroke-dashoffset: -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .logo-trace-segment { animation: none !important; stroke-dasharray: 1 !important; }
        }
      `}</style>
    </svg>
  );
}
