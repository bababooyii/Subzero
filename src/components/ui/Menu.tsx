"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/helpers/classname-helper";
import { menuDivider, menuPanel, menuRow, selected as selectedRecipe } from "@/lib/ui";

/** Radix DropdownMenu styled as a raised surface with the `menu-in` entrance. */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

type ContentProps = ComponentPropsWithoutRef<typeof DropdownMenu.Content>;

export function MenuContent({ className, sideOffset = 8, align = "start", ...props }: ContentProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(menuPanel, "min-w-48 outline-none", className)}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

type ItemProps = Omit<ComponentPropsWithoutRef<typeof DropdownMenu.Item>, "children" | "asChild"> & {
  icon?: ReactNode;
  /** Highlights the row with the `selected` recipe. */
  selected?: boolean;
  /** Trailing content, e.g. a check icon. */
  trailing?: ReactNode;
  /** Renders the row as a Next link instead of an action. */
  href?: string;
  children: ReactNode;
};

export function MenuItem({ icon, selected, trailing, href, className, children, ...props }: ItemProps) {
  const cls = cn(menuRow, selected && selectedRecipe, className);
  const content = (
    <>
      {icon ? <span className="shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </>
  );
  if (href) {
    return (
      <DropdownMenu.Item asChild {...props}>
        <Link href={href} className={cls}>
          {content}
        </Link>
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item className={cls} {...props}>
      {content}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-3 py-1.5 text-[11px] font-medium tracking-wide text-muted/70 uppercase", className)} {...props} />;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={menuDivider} />;
}
