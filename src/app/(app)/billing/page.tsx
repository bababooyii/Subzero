import { BillingRun } from "@/components/billing/BillingRun";
import { billingRun } from "@/lib/mock/selectors-billing";

export const metadata = { title: "Billing run · Brightloop" };

export default function Page() {
  return <BillingRun initial={billingRun()} />;
}
