import { cn } from "@/helpers/classname-helper";
import { formatMoney } from "@/lib/format";

export type AgeingBar = { key: string; label: string; count: number; amount: number };

/** Three horizontal bars (stacked with a gap; pass `my-auto` in a flex column to centre them in a tall card). Grey, except the last bucket (60+ days), which is red. */
export function AgeingBars({ buckets, className }: { buckets: AgeingBar[]; className?: string }) {
  const max = Math.max(...buckets.map((b) => b.amount), 1);
  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {buckets.map((b, i) => {
        const danger = i === buckets.length - 1;
        return (
          <li key={b.key}>
            <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
              <span className="text-muted">{b.label}</span>
              <span className="text-text tabular-nums">
                {formatMoney(b.amount)} <span className="text-muted">· {b.count}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn("h-full origin-left animate-[grow_0.7s_cubic-bezier(.2,.8,.2,1)_both] rounded-full", danger ? "bg-[#f43f5e]" : "bg-[#6b6a66]")}
                style={{ width: `${Math.max(b.amount ? 3 : 0, (b.amount / max) * 100)}%`, animationDelay: `${i * 80}ms` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
