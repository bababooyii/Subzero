import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SubscriptionRecord } from "@/components/subscriptions/SubscriptionRecord";
import { isUuid, toSubscriptionDetail } from "@/components/subscriptions/rows";
import { db } from "@/db/client";
import { listPaymentTerms, listTaxes } from "@/features/catalog/queries";
import { listInvoices } from "@/features/invoices/queries";
import { getSubscription, quoteSubscription } from "@/features/subscriptions/queries";
import { todayIST } from "@/lib/dates";

export default function Page(props: PageProps<"/subscriptions/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1240px] animate-pulse px-8 py-8" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/subscriptions/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const today = todayIST();
  const sub = await getSubscription(db, id);
  if (!sub) notFound();
  const [quote, invoices, terms, taxes] = await Promise.all([
    quoteSubscription(db, id, today),
    listInvoices(db, { subscriptionId: id, today, pageSize: 100 }),
    listPaymentTerms(db),
    listTaxes(db),
  ]);
  const termName = terms.find((t) => t.id === sub.paymentTermId)?.name ?? "—";
  const detail = toSubscriptionDetail(sub, quote, invoices.rows, termName, taxes);
  return <SubscriptionRecord key={detail.id} detail={detail} />;
}
