import { Users } from "lucide-react";
import { Suspense } from "react";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews } from "@/components/ui/SavedViews";
import { db } from "@/db/client";
import { todayIST } from "@/lib/dates";
import { formatMoneyCompact, formatNumber } from "@/lib/format";
import { readPaging } from "@/lib/table-params";
import { CUSTOMER_VIEWS, listCustomerRows, overdueCustomerCount, parseCustomerView } from "./list-query";

export const metadata = { title: "Customers · Brightloop" };

export default function CustomersPage(props: PageProps<"/customers">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1440px] animate-pulse px-8 py-8" />}>
      <Customers {...props} />
    </Suspense>
  );
}

const EMPTY: Record<string, { title: string; subtitle: string }> = {
  overdue: { title: "No overdue customers", subtitle: "Everything is paid up." },
  inactive: { title: "Everyone has an active plan", subtitle: "Nobody is sitting without a subscription." },
};

async function Customers({ searchParams }: PageProps<"/customers">) {
  const sp = await searchParams;
  const view = parseCustomerView(typeof sp.view === "string" ? sp.view : undefined);
  const today = todayIST();
  const [list, overdueCount] = await Promise.all([
    listCustomerRows(db, { ...readPaging(sp), view, today }),
    overdueCustomerCount(db, today),
  ]);
  const current = CUSTOMER_VIEWS.find((v) => v.key === view)!;
  const empty = EMPTY[view];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<Users />}
            title={`${formatNumber(list.total)} ${list.total === 1 ? "customer" : "customers"}`}
            subtitle={list.outstanding ? `${formatMoneyCompact(list.outstanding)} outstanding in this view` : current.description}
          />
          <SavedViews
            aria-label="Customer views"
            active={view}
            views={CUSTOMER_VIEWS.map((v) => ({
              key: v.key,
              label: v.label,
              description: v.description,
              href: v.key === "all" ? "/customers" : `/customers?view=${v.key}`,
              count: v.key === "overdue" ? overdueCount : undefined,
            }))}
          />
        </>
      }
    >
      <CustomersTable
        key={view}
        rows={list.rows}
        paging={{ total: list.total, page: list.page, pageSize: list.pageSize }}
        emptyTitle={empty?.title}
        emptySubtitle={empty?.subtitle}
      />
    </PageGrid>
  );
}
