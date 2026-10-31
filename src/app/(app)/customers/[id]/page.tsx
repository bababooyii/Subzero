import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerRecord } from "@/components/customers/CustomerRecord";
import { customerDetail } from "@/lib/mock/selectors-subscriptions";

export default function Page(props: PageProps<"/customers/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1240px] animate-pulse px-8 py-8" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const detail = customerDetail(id);
  if (!detail) notFound();
  return <CustomerRecord detail={detail} />;
}
