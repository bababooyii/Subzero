"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import type { SearchIndex } from "@/lib/mock/selectors";
import { CommandPalette, type PaletteGroup } from "./CommandPalette";
import { CustomersIcon, PersonIcon, SignOutIcon, SlidersIcon, StoreIcon, SubscriptionsIcon } from "./icons";
import { CATALOG_NAV, MAIN_NAV, SETTINGS_NAV } from "./nav";
import { RoleProvider, useRole } from "./role";
import { ShellFrame } from "./ShellFrame";
import { type NavCounts, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Sidebar for the (app) group. Catalog and Settings are admin-only. */
function AdminSidebar({ counts }: { counts: NavCounts }) {
  const { role } = useRole();
  return (
    <Sidebar
      homeHref="/dashboard"
      counts={counts}
      main={MAIN_NAV}
      catalog={role === "admin" ? CATALOG_NAV : undefined}
      bottom={role === "admin" ? SETTINGS_NAV : undefined}
    />
  );
}

function AdminTopBar({ index }: { index: SearchIndex }) {
  const { role, setRole } = useRole();
  const pages = [...MAIN_NAV, ...(role === "admin" ? [...CATALOG_NAV, SETTINGS_NAV] : [])];
  const groups: PaletteGroup[] = [
    {
      heading: "Subscriptions",
      icon: SubscriptionsIcon,
      items: index.subscriptions.slice(0, 60).map((s) => ({ id: s.id, href: `/subscriptions/${s.id}`, value: `${s.number} ${s.customer}`, lead: s.number, label: s.customer })),
    },
    {
      heading: "Customers",
      icon: CustomersIcon,
      items: index.customers.map((c) => ({ id: c.id, href: `/customers/${c.id}`, value: `customer ${c.name} ${c.city}`, label: c.name, trail: c.city })),
    },
  ];
  return (
    <TopBar search={<CommandPalette pages={pages} groups={groups} />} accountIcon={<SlidersIcon />}>
      <MenuLabel>Demo role</MenuLabel>
      <MenuItem
        selected={role === "admin"}
        icon={<PersonIcon />}
        trailing={role === "admin" ? <Check size={14} strokeWidth={3} /> : null}
        onSelect={() => setRole("admin")}
      >
        Admin
      </MenuItem>
      <MenuItem
        selected={role === "staff"}
        icon={<PersonIcon />}
        trailing={role === "staff" ? <Check size={14} strokeWidth={3} /> : null}
        onSelect={() => setRole("staff")}
      >
        Staff
      </MenuItem>
      <MenuSeparator />
      <MenuItem href="/portal" icon={<StoreIcon />}>Customer portal</MenuItem>
      {role === "admin" ? (
        <MenuItem href="/settings" icon={<SlidersIcon />}>Settings</MenuItem>
      ) : null}
      <MenuItem href="/login" icon={<SignOutIcon />}>Sign out</MenuItem>
    </TopBar>
  );
}

/** Persistent shell for the (app) route group: full-height sidebar + top bar over a fixed-height content area. Never remounts between pages. */
export function AppShell({ counts, index, children }: { counts: NavCounts; index: SearchIndex; children: ReactNode }) {
  return (
    <RoleProvider>
      <ShellFrame sidebar={<AdminSidebar counts={counts} />} topBar={<AdminTopBar index={index} />}>
        {children}
      </ShellFrame>
    </RoleProvider>
  );
}
