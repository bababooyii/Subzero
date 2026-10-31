import { Receipt } from "lucide-react";
import { Suspense } from "react";
import { InvoiceTable } from "@/components/billing/InvoiceTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews, type SavedView } from "@/components/ui/SavedViews";
import { formatMoneyCompact } from "@/lib/format";
import { INVOICE_VIEWS, type InvoiceView, invoiceRows, invoiceViewCounts } from "@/lib/mock/selectors-billing";

export const metadata = { title: "Invoices · Brightloop" };

const VIEW_LABEL: Record<InvoiceView, string> = {
  all: "All",
  draft: "Draft",
  confirmed: "Confirmed",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};
const EMPTY: Record<InvoiceView, [string, string]> = {
  all: ["No invoices yet", "Run billing to create the first ones."],
  draft: ["No draft invoices", "Run billing to create some."],
  confirmed: ["No confirmed invoices", "Confirmed invoices that are not late show up here."],
  paid: ["No paid invoices", "Paid invoices show up here."],
  overdue: ["No overdue invoices", "Everything is paid up."],
  cancelled: ["No cancelled invoices", "Cancelled invoices show up here."],
};

export default function Page(props: PageProps<"/invoices">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Invoices {...props} />
    </Suspense>
  );
}

async function Invoices({ searchParams }: PageProps<"/invoices">) {
  const sp = await searchParams;
  const param = typeof sp.view === "string" ? sp.view : "all";
  const view = (INVOICE_VIEWS as string[]).includes(param) ? (param as InvoiceView) : "all";

  const rows = invoiceRows(view);
  const counts = invoiceViewCounts();
  const outstanding = rows.reduce((n, r) => n + r.balance, 0);
  const views: SavedView[] = INVOICE_VIEWS.map((v) => ({
    key: v,
    label: VIEW_LABEL[v],
    href: v === "all" ? "/invoices" : `/invoices?view=${v}`,
    // Counts carry meaning only: drafts to confirm and overdue invoices.
    count: v === "draft" || v === "overdue" ? counts[v] : undefined,
  }));
  const [emptyTitle, emptySubtitle] = EMPTY[view];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<Receipt />}
            title={`${rows.length} ${rows.length === 1 ? "invoice" : "invoices"}`}
            subtitle={`${formatMoneyCompact(outstanding)} outstanding`}
          />
          <SavedViews views={views} active={view} aria-label="Invoice views" />
        </>
      }
    >
      <InvoiceTable key={view} rows={rows} emptyTitle={emptyTitle} emptySubtitle={emptySubtitle} />
    </PageGrid>
  );
}
