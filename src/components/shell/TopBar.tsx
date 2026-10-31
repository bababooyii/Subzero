"use client";

import type { ReactNode } from "react";
import { cn } from "@/helpers/classname-helper";
import { raised } from "@/lib/ui";
import { Menu, MenuContent, MenuTrigger } from "@/components/ui/Menu";

type Props = {
  /** The search / ⌘K button. */
  search: ReactNode;
  /** Icon inside the round account button. */
  accountIcon: ReactNode;
  /** Width class for the account menu panel. */
  menuClassName?: string;
  /** Account menu rows. */
  children: ReactNode;
};

/** Slim top bar: search and the account button. The shells supply both. */
export function TopBar({ search, accountIcon, menuClassName = "w-52", children }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-3 bg-bg px-4 sm:px-6">

      <div className="flex items-center gap-2">
        {search}
        <Menu>
          <MenuTrigger
            aria-label="Account"
            className={cn("grid size-9 cursor-pointer place-items-center rounded-full text-muted outline-none hover:bg-[#242424] hover:text-text focus-visible:outline-2 focus-visible:outline-accent", raised)}
          >
            {accountIcon}
          </MenuTrigger>
          <MenuContent align="end" className={menuClassName}>
            {children}
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
