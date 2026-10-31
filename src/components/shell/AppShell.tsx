"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { authClient } from "@/components/auth/auth-client";
import { MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { CommandPalette } from "./CommandPalette";
import { SignOutIcon, SlidersIcon } from "./icons";
import { CATALOG_NAV, MAIN_NAV, SETTINGS_NAV } from "./nav";
import { type AppRole, RoleProvider, useRole } from "./role";
import { ShellFrame } from "./ShellFrame";
import { paletteGroups } from "./search-source";
import { type NavCounts, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type ShellUser = { name: string; email: string };

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

function AdminTopBar({ user }: { user: ShellUser }) {
  const { role } = useRole();
  const router = useRouter();
  const pages = [...MAIN_NAV, ...(role === "admin" ? [...CATALOG_NAV, SETTINGS_NAV] : [])];

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <TopBar search={<CommandPalette pages={pages} groups={paletteGroups()} placeholder="Jump to a page" />} accountIcon={<SlidersIcon />}>
      <MenuLabel>{user.name}</MenuLabel>
      {role === "admin" ? (
        <MenuItem href="/settings" icon={<SlidersIcon />}>Settings</MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem icon={<SignOutIcon />} onSelect={signOut}>Sign out</MenuItem>
    </TopBar>
  );
}

/** Persistent shell for the (app) route group: full-height sidebar + top bar over a fixed-height content area. Never remounts between pages. */
export function AppShell({ role, user, counts, children }: { role: AppRole; user: ShellUser; counts: NavCounts; children: ReactNode }) {
  return (
    <RoleProvider role={role}>
      <ShellFrame sidebar={<AdminSidebar counts={counts} />} topBar={<AdminTopBar user={user} />}>
        {children}
      </ShellFrame>
    </RoleProvider>
  );
}
