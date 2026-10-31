import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceDocument } from "@/components/billing/InvoiceDocument";
import { PrintButton } from "@/components/billing/PrintButton";
import { invoiceDetail } from "@/lib/mock/selectors-billing";

export const metadata = { title: "Invoice · Brightloop" };

const toolbarBtn =
  "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e6e5e1] bg-white px-3 text-[13px] text-[#1c1c1a] hover:bg-[#f7f7f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b5bdb]";

export default function Page(props: PageProps<"/invoices/[id]/print">) {
  return (
    <Suspense fallback={null}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/invoices/[id]/print">) {
  const { id } = await params;
  const d = invoiceDetail(id);
  if (!d) notFound();
  const open = d.status === "confirmed";
  const balance = open ? Math.max(0, d.total - d.amountPaid) : 0;
  return (
    <div className="px-4 py-6 print:p-0">
      <div className="mx-auto mb-4 flex w-[210mm] max-w-full items-center justify-between print:hidden">
        <Link href={`/invoices/${d.id}`} className={toolbarBtn}>
          <ArrowLeft size={14} /> Back to invoice
        </Link>
        <PrintButton className={toolbarBtn} />
      </div>
      <div className="shadow-[0_4px_24px_-8px_rgba(0,0,0,0.25)] print:shadow-none">
        <InvoiceDocument
          print
          data={{
            number: d.number,
            status: d.status,
            customer: d.customer,
            subscriptionNumber: d.subscription?.number,
            planName: d.subscription?.planName,
            paymentTerms: d.subscription?.paymentTerms,
            periodStart: d.periodStart,
            periodEnd: d.periodEnd,
            issueDate: d.issueDate,
            dueDate: d.dueDate,
            lines: d.lines,
            subtotal: d.subtotal,
            discountTotal: d.discountTotal,
            taxTotal: d.taxTotal,
            total: d.total,
            amountPaid: d.amountPaid,
            balance,
            paidOn: d.payments[0]?.date,
          }}
        />
      </div>
    </div>
  );
}
