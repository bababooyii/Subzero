import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PortalSubscriptionDetail } from "@/components/portal/PortalSubscriptionDetail";
import { portalSubscription } from "@/lib/mock/selectors-portal";

export default function Page(props: PageProps<"/portal/subscriptions/[id]">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/portal/subscriptions/[id]">) {
  const { id } = await params;
  const data = portalSubscription(id);
  if (!data) notFound();
  return <PortalSubscriptionDetail id={id} events={data.events} />;
}
