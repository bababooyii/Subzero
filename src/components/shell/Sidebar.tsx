"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/helpers/classname-helper";
import { chipIdle, chipSelected, raised, selected } from "@/lib/ui";
import type { NavItem } from "./nav";

/** Count chip values by `NavItem.chip` key. */
export type NavCounts = Record<string, number>;

function Row({ item, active, count }: { item: NavItem; active: boolean; count?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-accent lg:px-3",
        "max-lg:justify-center",
        active ? selected : "text-muted hover:bg-white/5 hover:text-text",
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span className="max-lg:sr-only truncate">{item.label}</span>
      {count ? <span className={cn(active ? chipSelected : chipIdle, "max-lg:sr-only", "ml-auto")}>{count}</span> : null}
    </Link>
  );
}

type Props = {
  /** Where the wordmark links to. */
  homeHref: string;
  counts: NavCounts;
  main: NavItem[];
  /** Optional second group under a "Catalog" label. */
  catalog?: NavItem[];
  /** Pinned to the bottom (Settings, Account). */
  bottom?: NavItem;
  "aria-label"?: string;
};

/** Persistent raised sidebar. Collapses to icons below `lg`. Mounted in a route-group layout so it never remounts. */
export function Sidebar({ homeHref, counts, main, catalog, bottom, ...rest }: Props) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));

  return (
    <aside className="sticky top-0 z-30 hidden h-dvh shrink-0 p-3 pr-0 sm:block lg:w-[232px]">
      <nav
        aria-label={rest["aria-label"] ?? "Main"}
        className={cn("flex h-full w-14 flex-col rounded-2xl p-1 lg:w-full", raised)}
      >
        <Link
          href={homeHref}
          aria-label="Brightloop home"
          className="mb-2 flex h-11 items-center gap-2.5 rounded-xl px-2.5 outline-none focus-visible:outline-2 focus-visible:outline-accent max-lg:justify-center lg:px-3"
        >
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-lg bg-text text-[12px] font-extrabold text-bg lg:hidden">B</span>
          <span className="text-[14px] font-extrabold tracking-[0.025em] text-text uppercase max-lg:sr-only">Brightloop</span>
        </Link>
        <ul className="flex flex-col gap-0.5">
          {main.map((item) => (
            <li key={item.href}>
              <Row item={item} active={isActive(item)} count={item.chip ? counts[item.chip] : undefined} />
            </li>
          ))}
        </ul>

        {catalog?.length ? (
          <>
            <p className="mt-3 mb-1 px-3 text-[11px] font-medium tracking-wide text-muted/70 uppercase max-lg:sr-only">Catalog</p>
            <div aria-hidden="true" className="mx-2 my-2 h-px bg-white/[0.06] lg:hidden" />
            <ul className="flex flex-col gap-0.5">
              {catalog.map((item) => (
                <li key={item.href}>
                  <Row item={item} active={isActive(item)} />
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {bottom ? (
          <div className="mt-auto pt-2">
            <div aria-hidden="true" className="mx-2 mb-1 h-px bg-white/[0.06]" />
            <Row item={bottom} active={isActive(bottom)} />
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
