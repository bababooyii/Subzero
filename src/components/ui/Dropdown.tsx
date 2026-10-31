"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { field, menuPanel, menuRow, selected as selectedRecipe } from "@/lib/ui";

export type DropdownOption = {
  value: string;
  label: ReactNode;
  /** 12px muted line under the label. */
  description?: string;
  icon?: ReactNode;
  /** Plain text for type-ahead when `label` is not a string. */
  textValue?: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** Shown when `value` matches no option. */
  placeholder?: ReactNode;
  "aria-label"?: string;
  /** Applied to the trigger (e.g. `w-40`). */
  className?: string;
  /** Panel alignment against the trigger. */
  align?: "start" | "center" | "end";
  /** md = 32px (default), sm = 28px. */
  size?: "md" | "sm";
  /** Trigger id, so a `<Field htmlFor>` label points at it. */
  id?: string;
  /** Renders a hidden input with this name and the current value, for plain `<form>` posts. */
  name?: string;
  disabled?: boolean;
};

const textOf = (o: DropdownOption) => (o.textValue ?? (typeof o.label === "string" ? o.label : o.value)).toLowerCase();

/**
 * The app's one select control (replaces native `<select>`). Radix Popover with a listbox panel:
 * Up/Down/Home/End move, Enter or Space picks, Escape closes and refocuses the trigger, typing jumps by prefix.
 */
export function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  className,
  align = "start",
  size = "md",
  id,
  name,
  disabled,
  ...rest
}: Props) {
  const uid = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", timer: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.value === value);

  const enabled = (i: number) => !options[i]?.disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let n = 1; n <= options.length; n++) {
      const i = (from + dir * n + options.length * n) % options.length;
      if (enabled(i)) return i;
    }
    return from;
  };

  const openChange = (next: boolean) => {
    if (next) {
      const at = options.findIndex((o) => o.value === value);
      setActive(at >= 0 ? at : Math.max(0, options.findIndex((o) => !o.disabled)));
    }
    setOpen(next);
  };

  const pick = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    setOpen(false);
  };

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => step(a, 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => step(a, -1));
        return;
      case "Home":
        e.preventDefault();
        setActive(step(-1, 1));
        return;
      case "End":
        e.preventDefault();
        setActive(step(options.length, -1));
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = typed.current;
      window.clearTimeout(t.timer);
      t.text += e.key.toLowerCase();
      t.timer = window.setTimeout(() => (t.text = ""), 600);
      // One letter cycles through the matches after the current row; a longer prefix narrows from the current row.
      const cycle = new Set(t.text).size === 1;
      const prefix = cycle ? t.text[0] : t.text;
      const start = cycle ? 1 : 0;
      for (let n = start; n < start + options.length; n++) {
        const i = (active + n) % options.length;
        if (enabled(i) && textOf(options[i]).startsWith(prefix)) {
          setActive(i);
          break;
        }
      }
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${uid}-list` : undefined}
          aria-label={rest["aria-label"]}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              openChange(true);
            }
          }}
          className={cn(
            field,
            "group inline-flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-default disabled:opacity-50",
            size === "sm" && "h-7",
            className,
          )}
        >
          <span className={cn("flex min-w-0 items-center gap-2", !current && "text-muted")}>
            {current?.icon ? <span className="shrink-0 [&_svg]:size-4">{current.icon}</span> : null}
            <span className="truncate">{current ? current.label : placeholder}</span>
          </span>
          <ChevronDown size={12} strokeWidth={2.5} aria-hidden="true" className="shrink-0 text-muted transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </button>
      </Popover.Trigger>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          // Focus lands on the listbox so arrow keys work at once; closing returns focus to the trigger.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            listRef.current?.focus({ preventScroll: true });
          }}
          className={cn(menuPanel, "w-max max-w-[min(360px,calc(100vw-24px))] min-w-[var(--radix-popover-trigger-width)] outline-none")}
        >
          <div
            ref={listRef}
            id={`${uid}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label={rest["aria-label"]}
            aria-activedescendant={`${uid}-opt-${active}`}
            onKeyDown={onListKey}
            className="scroll-quiet max-h-[min(320px,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain outline-none"
          >
            {options.map((o, i) => {
              const on = o.value === value;
              return (
                <div
                  key={o.value}
                  id={`${uid}-opt-${i}`}
                  role="option"
                  aria-selected={on}
                  aria-disabled={o.disabled || undefined}
                  data-index={i}
                  data-active={i === active || undefined}
                  onPointerMove={() => i !== active && enabled(i) && setActive(i)}
                  onClick={() => pick(i)}
                  className={cn(
                    menuRow,
                    "items-start",
                    on ? selectedRecipe : i === active && "bg-white/5 text-text",
                    o.disabled && "pointer-events-none opacity-40",
                  )}
                >
                  {o.icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-4">{o.icon}</span> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.description ? <span className="block truncate text-[12px] text-muted">{o.description}</span> : null}
                  </span>
                  {on ? <Check size={14} strokeWidth={3} aria-hidden="true" className="mt-0.5 shrink-0" /> : null}
                </div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
