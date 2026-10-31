import { Receipt } from "lucide-react";
import { Suspense } from "react";
import { InvoiceTable } from "@/components/billing/InvoiceTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews, type SavedView } from "@/components/ui/SavedViews";
import { db } from "@/db/client";
import { listInvoices } from "@/features/invoices/queries";
import { todayIST } from "@/lib/dates";
import { formatMoneyCompact, formatNumber } from "@/lib/format";
import { readPaging } from "@/lib/table-params";
import { INVOICE_VIEWS, type InvoicePageView, outstandingFor, viewFilter } from "./queries";

export const metadata = { title: "Invoices · Brightloop" };

const VIEW_LABEL: Record<InvoicePageView, string> = {
  all: "All",
  draft: "Draft",
  confirmed: "Confirmed",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};
const EMPTY: Record<InvoicePageView, [string, string]> = {
  all: ["No invoices yet", "Run billing to create the first ones."],
  draft: ["No draft invoices", "Run billing to create some."],
  confirmed: ["No confirmed invoices", "Confirmed invoices show up here."],
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
  const view = (INVOICE_VIEWS as readonly string[]).includes(param) ? (param as InvoicePageView) : "all";
  const paging = readPaging(sp);
  const today = todayIST();

  const [list, drafts, overdue, outstanding] = await Promise.all([
    listInvoices(db, { ...viewFilter(view), ...paging, today }),
    listInvoices(db, { view: "draft", today, pageSize: 1 }),
    listInvoices(db, { view: "overdue", today, pageSize: 1 }),
    outstandingFor(view, today),
  ]);
  const counts: Partial<Record<InvoicePageView, number>> = { draft: drafts.total, overdue: overdue.total };

  const views: SavedView[] = INVOICE_VIEWS.map((v) => ({
    key: v,
    label: VIEW_LABEL[v],
    href: v === "all" ? "/invoices" : `/invoices?view=${v}`,
    // Counts carry meaning only: drafts to confirm and overdue invoices.
    count: counts[v],
  }));
  const [emptyTitle, emptySubtitle] = EMPTY[view];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<Receipt />}
            title={`${formatNumber(list.total)} ${list.total === 1 ? "invoice" : "invoices"}`}
            subtitle={`${formatMoneyCompact(outstanding)} outstanding`}
          />
          <SavedViews views={views} active={view} aria-label="Invoice views" />
        </>
      }
    >
      <InvoiceTable
        key={view}
        rows={list.rows}
        paging={{ total: list.total, page: list.page, pageSize: list.pageSize }}
        emptyTitle={emptyTitle}
        emptySubtitle={emptySubtitle}
      />
    </PageGrid>
  );
}
