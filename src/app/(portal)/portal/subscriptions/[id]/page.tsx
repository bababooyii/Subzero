import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPortalData, loadSubscriptionEvents } from "@/components/portal/load";
import { PortalSubscriptionDetail } from "@/components/portal/PortalSubscriptionDetail";

export default function Page(props: PageProps<"/portal/subscriptions/[id]">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/portal/subscriptions/[id]">) {
  const { id } = await params;
  // Only the customer's own (non-draft) subscriptions are in this list, so anything else is a 404.
  const { subs } = await getPortalData();
  if (!subs.some((s) => s.id === id)) notFound();
  const events = await loadSubscriptionEvents(id);
  return <PortalSubscriptionDetail id={id} events={events} />;
}
