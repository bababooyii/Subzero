import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isUuid, subscriptionInfo } from "@/app/(app)/invoices/detail";
import { InvoiceDocument } from "@/components/billing/InvoiceDocument";
import { PrintButton } from "@/components/billing/PrintButton";
import { toLineView } from "@/components/billing/invoice-types";
import { db } from "@/db/client";
import { getInvoiceForPrint } from "@/features/portal/queries";
import { requireActor, UnauthorizedError } from "@/lib/auth/session";

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
  if (!isUuid(id)) notFound();
  let actor;
  try {
    actor = await requireActor();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/login");
    throw err;
  }
  // Staff and admins can print any invoice; a customer only their own (non-draft) ones.
  const print = await getInvoiceForPrint(db, actor, id);
  if (!print) notFound();
  const d = print.invoice;
  const sub = await subscriptionInfo(d.subscriptionId);
  const open = d.status === "confirmed";
  const balance = open ? Math.max(0, d.total - d.amountPaid) : 0;
  const backHref = actor.role === "customer" ? "/portal" : `/invoices/${d.id}`;
  return (
    <div className="px-4 py-6 print:p-0">
      <div className="mx-auto mb-4 flex w-[210mm] max-w-full items-center justify-between print:hidden">
        <Link href={backHref} className={toolbarBtn}>
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
            customer: {
              name: print.customer.name,
              contactName: print.customer.company ?? "",
              email: print.customer.email,
              city: print.customer.address ?? "",
              gstin: print.customer.gstin ?? "",
            },
            subscriptionNumber: sub?.number,
            planName: sub?.planName,
            paymentTerms: sub?.paymentTerms,
            periodStart: d.periodStart,
            periodEnd: d.periodEnd,
            issueDate: d.issuedOn,
            dueDate: d.dueDate,
            lines: d.lines.map(toLineView),
            subtotal: d.subtotal,
            discountTotal: d.discountTotal,
            taxTotal: d.taxTotal,
            total: d.total,
            amountPaid: d.amountPaid,
            balance,
            paidOn: d.payments.at(-1)?.paidOn,
          }}
        />
      </div>
    </div>
  );
}
