import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceView } from "@/components/billing/InvoiceView";
import { invoiceDetail } from "@/lib/mock/selectors-billing";

export default function Page(props: PageProps<"/invoices/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1240px] animate-pulse px-8 py-8" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const detail = invoiceDetail(id);
  if (!detail) notFound();
  return <InvoiceView detail={detail} />;
}
