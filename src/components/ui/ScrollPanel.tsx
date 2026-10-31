"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/helpers/classname-helper";

const FADE = "28px";

type Props = { className?: string; children: ReactNode };

/**
 * Fixed-height internal scroller with soft top/bottom fades that appear only while there is content
 * above or below (design-adaptation "Fit to screen"). Size it from outside (`flex-1`, `h-full`, a grid cell):
 * it has `min-h-0`, so it shrinks to its slot instead of growing the page. No visible scrollbar.
 */
export function ScrollPanel({ className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const content = inner.current;
    if (!el || !content) return;
    let frame = 0;
    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      el.style.setProperty("--fade-top", el.scrollTop > 1 ? FADE : "0px");
      el.style.setProperty("--fade-bottom", max - el.scrollTop > 1 ? FADE : "0px");
      setScrollable(max > 1);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    ro.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", schedule);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      // Keyboard users can only scroll a region they can focus, so it is focusable while it overflows.
      tabIndex={scrollable ? 0 : undefined}
      className={cn("scroll-quiet scroll-fade min-h-0 overflow-y-auto overscroll-contain outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent", className)}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
