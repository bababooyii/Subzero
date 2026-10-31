"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/helpers/classname-helper";
import { btnSquare, heroBody, heroFrame } from "@/lib/ui";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

type Props = {
  title: string;
  description?: string;
  /** Footer actions (left and right groups). Rendered inside the hero frame under the body. */
  footer?: ReactNode;
  /** Width in px. Defaults to the 402px hero card. */
  width?: number;
  className?: string;
  children: ReactNode;
};

/** Radix Dialog inside a hero frame, over a blurred backdrop. */
export function DialogContent({ title, description, footer, width = 402, className, children }: Props) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/90 backdrop-blur-[12px]" />
      <RadixDialog.Content
        className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 animate-fade-in outline-none"
        style={{ maxWidth: width }}
      >
        <div className={cn(heroFrame)}>
          <div className={cn(heroBody, "max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-b-none p-4", className)}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <RadixDialog.Title className="text-[15px] font-medium text-text">{title}</RadixDialog.Title>
                {description ? (
                  <RadixDialog.Description className="mt-0.5 text-[12px] text-muted">{description}</RadixDialog.Description>
                ) : (
                  <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
                )}
              </div>
              <RadixDialog.Close className={cn(btnSquare, "-mt-1 -mr-1 size-7")} aria-label="Close">
                <X size={14} strokeWidth={2.5} />
              </RadixDialog.Close>
            </div>
            {children}
          </div>
          {footer ? <div className="flex items-center justify-between gap-1.5 px-3 py-2.5">{footer}</div> : null}
        </div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
