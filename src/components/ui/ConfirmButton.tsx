"use client";

import * as Popover from "@radix-ui/react-popover";
import { type ReactNode, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { btnDanger, btnSecondary, menuPanel } from "@/lib/ui";

type Props = {
  /** Trigger content, e.g. an icon and "Close". */
  children: ReactNode;
  /** Confirm panel heading, e.g. "Close SUB-0040?". */
  title: ReactNode;
  description?: ReactNode;
  /** Red confirm button label. */
  confirmLabel: ReactNode;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
};

/** A destructive action behind a click-to-confirm panel (design-system: confirm before irreversible actions). */
export function ConfirmButton({ children, title, description, confirmLabel, onConfirm, className, disabled }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" disabled={disabled} className={cn(btnDanger, className)}>
          {children}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className={cn(menuPanel, "w-72 p-3")}>
          <p className="text-[13px] font-medium text-text">{title}</p>
          {description ? <p className="mt-1 text-[12px] text-muted">{description}</p> : null}
          <div className="mt-3 flex justify-end gap-1.5">
            <Popover.Close asChild>
              <button type="button" className={btnSecondary}>
                Keep it
              </button>
            </Popover.Close>
            <button
              type="button"
              className={btnDanger}
              autoFocus
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
