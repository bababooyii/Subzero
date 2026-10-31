import { PortalAccount } from "@/components/portal/PortalAccount";
import { portalCustomer } from "@/lib/mock/selectors-portal";

export const metadata = { title: "Account · Brightloop" };

export default function Page() {
  return <PortalAccount customer={portalCustomer()} />;
}
