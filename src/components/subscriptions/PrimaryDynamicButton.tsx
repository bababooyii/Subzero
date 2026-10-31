"use client";

import { DynamicButton, type DynamicButtonProps } from "@/components/kitchen/DynamicButton";
import { cn } from "@/helpers/classname-helper";

/**
 * Kitchen `DynamicButton` restyled as the white primary action (btnPrimary look).
 * The Kitchen component ships light-theme classes, so the overrides are marked important.
 */
export function PrimaryDynamicButton({ className, ...props }: Omit<DynamicButtonProps, "variant" | "width">) {
  return (
    <DynamicButton
      {...props}
      variant="primary"
      className={cn(
        "h-8! rounded-md! border-transparent! bg-text! px-2.5! text-[13px]! text-bg! hover:bg-text! hover:opacity-90 disabled:cursor-default disabled:opacity-60",
        className,
      )}
    />
  );
}
