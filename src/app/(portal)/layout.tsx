import { Suspense, type ReactNode } from "react";
import { db } from "@/db/client";
import { requireCustomerUser } from "@/components/shell/guard";
import { PortalShell } from "@/components/shell/PortalShell";
import { myInvoices, mySubscriptions } from "@/features/portal/queries";

async function Frame({ children }: { children: ReactNode }) {
  const user = await requireCustomerUser();
  const actor = { id: user.id, role: user.role };
  const [subs, invoices] = await Promise.all([mySubscriptions(db, actor), myInvoices(db, actor, { pageSize: 200 })]);
  const number = new Map(subs.map((s) => [s.id, s.number]));
  return (
    <PortalShell
      customerName={user.name}
      unpaid={invoices.rows.filter((i) => i.balance > 0 && i.status !== "cancelled").length}
      subs={subs.map((s) => ({ id: s.id, number: s.number, planName: s.plan.name }))}
      invoices={invoices.rows.map((i) => ({ id: i.id, number: i.number, subscriptionId: i.subscriptionId, subscriptionNumber: number.get(i.subscriptionId) ?? "" }))}
    >
      {children}
    </PortalShell>
  );
}

export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={null}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}
