"use client";

import { type ReactNode, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { iconTile } from "@/lib/ui";

type Props = {
  icon: ReactNode;
  tone?: "success" | "danger";
  title: ReactNode;
  subtitle?: ReactNode;
  /** Temporary intros drain a timer bar, then leave upward. Persistent ones stay. */
  variant?: "persistent" | "temporary";
  /** Centre the block (empty states). */
  centered?: boolean;
  className?: string;
  children?: ReactNode;
};

/** Icon tile + title + muted subtitle. */
export function Intro({
  icon,
  tone = "success",
  title,
  subtitle,
  variant = "persistent",
  centered,
  className,
  children,
}: Props) {
  const [gone, setGone] = useState(false);
  const temporary = variant === "temporary";
  if (temporary && gone) return null;

  return (
    <div
      className={cn(
        "flex gap-3",
        // Empty states stack and centre; page headers sit in a row (tile beside title).
        centered ? "flex-col items-center text-center" : "flex-row items-center gap-x-4",
        temporary && "animate-leave-up",
        className,
      )}
      onAnimationEnd={(e) => {
        if (temporary && e.animationName === "leave-up") setGone(true);
      }}
    >
      <div
        className={cn(
          iconTile.base,
          iconTile[tone],
          "animate-pop",
          centered ? "[&_svg]:size-6" : "size-10 rounded-[14px] [&_svg]:size-5",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 animate-rise space-y-0.5" style={{ animationDelay: "60ms" }}>
        <h1 className="text-lg font-medium tracking-tight text-text">{title}</h1>
        {subtitle ? <p className={cn("text-[13px] leading-snug text-muted", !centered && "truncate")}>{subtitle}</p> : null}
        {temporary ? (
          <div className="mt-2 h-0.5 w-20 overflow-hidden rounded-full bg-white/10">
            <div className="h-full origin-left animate-drain bg-white/40" />
          </div>
        ) : null}
      </div>
      {children ? (
        <div className="animate-rise" style={{ animationDelay: "120ms" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
