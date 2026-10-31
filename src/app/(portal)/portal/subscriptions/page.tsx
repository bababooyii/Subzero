import { Suspense } from "react";
import { PortalSubscriptions } from "@/components/portal/PortalSubscriptions";
import { SUBSCRIPTION_VIEWS, type SubscriptionView } from "@/components/portal/views";

export const metadata = { title: "Subscriptions · Brightloop" };

export default function Page(props: PageProps<"/portal/subscriptions">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ searchParams }: PageProps<"/portal/subscriptions">) {
  const sp = await searchParams;
  const param = typeof sp.view === "string" ? sp.view : "all";
  const view = (SUBSCRIPTION_VIEWS as string[]).includes(param) ? (param as SubscriptionView) : "all";
  return <PortalSubscriptions view={view} />;
}
