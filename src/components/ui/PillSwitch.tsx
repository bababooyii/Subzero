"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { type ReactNode, useId } from "react";
import { cn } from "@/helpers/classname-helper";
import { chipIdle, chipSelected, focusRing, raised } from "@/lib/ui";

export type PillOption = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  /** Count chip beside the label. Hidden when 0 or undefined. */
  count?: number;
  /** Renders the option as a link (URL-driven state). Otherwise `onChange` is called. */
  href?: string;
};

type Props = {
  options: PillOption[];
  value: string;
  onChange?: (key: string) => void;
  className?: string;
  "aria-label"?: string;
};

const item = `relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] outline-none transition-colors ${focusRing}`;

/** Raised pill switcher with a sliding selected highlight (design-system pill nav). */
export function PillSwitch({ options, value, onChange, className, ...rest }: Props) {
  const group = useId();
  const reduce = useReducedMotion();
  return (
    <LayoutGroup id={group}>
      <div
        role="tablist"
        aria-label={rest["aria-label"]}
        className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1", raised, className)}
      >
        {options.map((o) => {
          const on = o.key === value;
          const inner = (
            <>
              {on ? (
                <motion.span
                  layoutId="pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-[#2a2a2a] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.25)]"
                  transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.18, duration: 0.4 }}
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-1.5 [&_svg]:size-3.5">
                {o.icon}
                {o.label}
                {o.count ? <span className={on ? chipSelected : chipIdle}>{o.count}</span> : null}
              </span>
            </>
          );
          const cls = cn(item, on ? "font-medium text-text" : "text-muted hover:text-text");
          return o.href ? (
            <Link key={o.key} href={o.href} role="tab" aria-selected={on} className={cls} scroll={false}>
              {inner}
            </Link>
          ) : (
            <button key={o.key} type="button" role="tab" aria-selected={on} className={cls} onClick={() => onChange?.(o.key)}>
              {inner}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
