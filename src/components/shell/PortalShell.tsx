"use client";

import { Check } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { unpaidInvoices } from "@/components/portal/derive";
import { usePortal } from "@/components/portal/PortalProvider";
import { CommandPalette, type PaletteGroup } from "./CommandPalette";
import { BackIcon, InvoicesIcon, PersonIcon, SignOutIcon, SubscriptionsIcon } from "./icons";
import { PORTAL_ACCOUNT_NAV, PORTAL_NAV } from "./nav";
import { ShellFrame } from "./ShellFrame";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/** Customer portal shell: the same frame as the admin app, with the portal's own sidebar, search and account menu. */
export function PortalShell({ customerName, children }: { customerName: string; children: ReactNode }) {
  const pathname = usePathname();
  const { subs, invoices } = usePortal();
  const unpaid = unpaidInvoices(invoices).length;
  const onAccount = pathname.startsWith(PORTAL_ACCOUNT_NAV.href);

  const groups: PaletteGroup[] = [
    {
      heading: "Subscriptions",
      icon: SubscriptionsIcon,
      items: subs.map((s) => ({ id: s.id, href: `/portal/subscriptions/${s.id}`, value: `${s.number} ${s.planName}`, lead: s.number, label: s.planName })),
    },
    {
      heading: "Invoices",
      icon: InvoicesIcon,
      items: invoices.map((i) => ({ id: i.id, href: `/portal/subscriptions/${i.subscriptionId}`, value: `${i.number} ${i.subscriptionNumber}`, lead: i.number, label: i.subscriptionNumber })),
    },
  ];

  return (
    <ShellFrame
      sidebar={<Sidebar aria-label="Portal" homeHref="/portal" counts={{ unpaid }} main={PORTAL_NAV} bottom={PORTAL_ACCOUNT_NAV} />}
      topBar={
        <TopBar
          search={<CommandPalette pages={[...PORTAL_NAV, PORTAL_ACCOUNT_NAV]} groups={groups} placeholder="Jump to a page, subscription or invoice" />}
          accountIcon={<PersonIcon />}
        >
          <MenuLabel>{customerName}</MenuLabel>
          <MenuItem href="/portal/account" icon={<PersonIcon />} selected={onAccount} trailing={onAccount ? <Check size={14} strokeWidth={3} /> : null}>
            Account
          </MenuItem>
          <MenuItem href="/dashboard" icon={<BackIcon />}>Back to billing</MenuItem>
          <MenuSeparator />
          <MenuItem href="/login" icon={<SignOutIcon />}>Sign out</MenuItem>
        </TopBar>
      }
    >
      {children}
    </ShellFrame>
  );
}
