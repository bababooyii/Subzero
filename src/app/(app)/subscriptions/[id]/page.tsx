import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SubscriptionRecord } from "@/components/subscriptions/SubscriptionRecord";
import { subscriptionDetail } from "@/lib/mock/selectors-subscriptions";

export default function Page(props: PageProps<"/subscriptions/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1240px] animate-pulse px-8 py-8" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/subscriptions/[id]">) {
  const { id } = await params;
  const detail = subscriptionDetail(id);
  if (!detail) notFound();
  return <SubscriptionRecord key={detail.id} detail={detail} />;
}
