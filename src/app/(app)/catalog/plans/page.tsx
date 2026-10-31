import { PlansView } from "@/components/catalog/PlansView";
import { listPlans, listSubscriptions, subscriptionMrr } from "@/lib/mock/selectors";
import { planStats } from "@/lib/mock/selectors-catalog";
import type { Subscription } from "@/lib/mock/types";

export const metadata = { title: "Plans · Brightloop" };

export default function Page() {
  const subs = listSubscriptions();
  return <PlansView initial={listPlans()} stats={planStats(subs, (s) => subscriptionMrr(s as Subscription))} />;
}
