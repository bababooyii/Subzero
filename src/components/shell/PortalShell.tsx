"use client";

import { Check } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/Menu";
import { authClient } from "@/components/auth/auth-client";
import { CommandPalette, type PaletteGroup } from "./CommandPalette";
import { InvoicesIcon, PersonIcon, SignOutIcon, SubscriptionsIcon } from "./icons";
import { PORTAL_ACCOUNT_NAV, PORTAL_NAV } from "./nav";
import { ShellFrame } from "./ShellFrame";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type Props = {
  customerName: string;
  /** Invoices with money still owed (sidebar chip). */
  unpaid: number;
  subs: { id: string; number: string; planName: string }[];
  invoices: { id: string; number: string; subscriptionId: string; subscriptionNumber: string }[];
  children: ReactNode;
};

/** Customer portal shell: the same frame as the admin app, with the portal's own sidebar, search and account menu. */
export function PortalShell({ customerName, unpaid, subs, invoices, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
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

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

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
          <MenuSeparator />
          <MenuItem icon={<SignOutIcon />} onSelect={signOut}>Sign out</MenuItem>
        </TopBar>
      }
    >
      {children}
    </ShellFrame>
  );
}
