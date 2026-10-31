import { Users } from "lucide-react";
import { Suspense } from "react";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews } from "@/components/ui/SavedViews";
import { formatMoneyCompact } from "@/lib/format";
import { CUSTOMER_VIEWS, customerRows, customerViewCounts, parseCustomerView } from "@/lib/mock/selectors-subscriptions";

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
  const rows = customerRows(view);
  const counts = customerViewCounts();
  const current = CUSTOMER_VIEWS.find((v) => v.key === view)!;
  const outstanding = rows.reduce((n, r) => n + r.outstanding, 0);
  const empty = EMPTY[view];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<Users />}
            title={`${rows.length} ${rows.length === 1 ? "customer" : "customers"}`}
            subtitle={outstanding ? `${formatMoneyCompact(outstanding)} outstanding in this view` : current.description}
          />
          <SavedViews
            aria-label="Customer views"
            active={view}
            views={CUSTOMER_VIEWS.map((v) => ({
              key: v.key,
              label: v.label,
              description: v.description,
              href: v.key === "all" ? "/customers" : `/customers?view=${v.key}`,
              count: v.key === "overdue" ? counts.overdue : undefined,
            }))}
          />
        </>
      }
    >
      <CustomersTable rows={rows} emptyTitle={empty?.title} emptySubtitle={empty?.subtitle} />
    </PageGrid>
  );
}
