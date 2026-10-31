import { Suspense } from "react";
import { PortalProvider } from "@/components/portal/PortalProvider";
import { PortalShell } from "@/components/shell/PortalShell";
import { portalCustomer, portalInvoices, portalSubscriptions } from "@/lib/mock/selectors-portal";

export default function PortalLayout({ children }: LayoutProps<"/">) {
  const customer = portalCustomer();
  return (
    <Suspense fallback={null}>
      <PortalProvider customer={customer} contactName={customer.contactName} subscriptions={portalSubscriptions()} invoices={portalInvoices()}>
        <PortalShell customerName={customer.contactName}>{children}</PortalShell>
      </PortalProvider>
    </Suspense>
  );
}
