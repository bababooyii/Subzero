import { Suspense } from "react";
import { PortalInvoices } from "@/components/portal/PortalInvoices";
import { INVOICE_VIEWS, type InvoiceView } from "@/components/portal/views";

export const metadata = { title: "Invoices · Brightloop" };

export default function Page(props: PageProps<"/portal/invoices">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ searchParams }: PageProps<"/portal/invoices">) {
  const sp = await searchParams;
  const param = typeof sp.view === "string" ? sp.view : "all";
  const view = (INVOICE_VIEWS as string[]).includes(param) ? (param as InvoiceView) : "all";
  return <PortalInvoices view={view} />;
}
