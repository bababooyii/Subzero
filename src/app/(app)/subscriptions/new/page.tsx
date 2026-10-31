import { Suspense } from "react";
import { NewSubscriptionForm } from "@/components/subscriptions/NewSubscriptionForm";
import { newSubscriptionData } from "@/lib/mock/selectors-subscriptions";

export const metadata = { title: "New subscription · Brightloop" };

export default function Page(props: PageProps<"/subscriptions/new">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1240px] animate-pulse px-8 py-8" />}>
      <Content {...props} />
    </Suspense>
  );
}

/** `?customer=` and `?template=` pre-fill the form (the customer page links here). */
async function Content({ searchParams }: PageProps<"/subscriptions/new">) {
  const sp = await searchParams;
  const customer = typeof sp.customer === "string" ? sp.customer : undefined;
  const template = typeof sp.template === "string" ? sp.template : undefined;
  return <NewSubscriptionForm data={newSubscriptionData()} initialCustomerId={customer} initialTemplateId={template} />;
}
