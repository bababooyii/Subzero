"use client";

import * as Popover from "@radix-ui/react-popover";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { btnDanger, btnSecondary, btnSquare, menuPanel } from "@/lib/ui";

type Props = {
  /** What is being deleted, for the accessible name and the confirm text. */
  label: string;
  onConfirm: () => void;
  className?: string;
};

/**
 * Delete button: a plain click opens a small confirm panel (design-system: confirm before permanent deletes).
 * Replaces the earlier hold-to-delete, which users didn't discover.
 */
export function HoldDelete({ label, onConfirm, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Delete ${label}`}
          title="Delete"
          className={cn(btnSquare, "hover:text-[#f43f5e] data-[state=open]:text-[#f43f5e]", className)}
        >
          <Trash2 aria-hidden="true" size={15} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className={cn(menuPanel, "w-64 p-3")}>
          <p className="text-[13px] font-medium text-text">Delete {label}?</p>
          <p className="mt-1 text-[12px] text-muted">This can&apos;t be undone.</p>
          <div className="mt-3 flex justify-end gap-1.5">
            <Popover.Close asChild>
              <button type="button" className={btnSecondary}>
                Cancel
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
              <Trash2 aria-hidden="true" size={13} /> Delete
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
