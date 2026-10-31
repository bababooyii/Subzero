import Link from "next/link";
import { cn } from "@/helpers/classname-helper";
import { formatDateTime } from "@/lib/format";

export type TimelineEvent = { id: string; at: string; text: string; /** Where the event's record lives; the sentence links there. */ href?: string };

type Props = { events: TimelineEvent[]; className?: string; empty?: string };

/** Activity timeline: 12px muted time, 13px sentence, hairline connector. New events rise in. */
export function Timeline({ events, className, empty = "No activity yet." }: Props) {
  if (events.length === 0) return <p className="text-[13px] text-muted">{empty}</p>;
  return (
    <ol className={cn("relative", className)}>
      {events.map((e, i) => (
        <li
          key={e.id}
          className="relative animate-rise pb-4 pl-5 last:pb-0"
          style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}
        >
          {i < events.length - 1 ? (
            <span aria-hidden="true" className="absolute top-3 bottom-0 left-[3px] w-px bg-white/[0.08]" />
          ) : null}
          <span aria-hidden="true" className="absolute top-[5px] left-0 size-[7px] rounded-full bg-white/25" />
          <p className="text-[12px] text-muted tabular-nums">{formatDateTime(e.at)}</p>
          <p className="text-[13px] text-text">
            {e.href ? (
              <Link href={e.href} className="outline-none hover:underline focus-visible:underline">
                {e.text}
              </Link>
            ) : (
              e.text
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
