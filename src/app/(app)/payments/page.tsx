import { CreditCard } from "lucide-react";
import { Suspense } from "react";
import { METHOD_LABEL } from "@/components/billing/draft";
import { PaymentsTable } from "@/components/billing/PaymentsTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews, type SavedView } from "@/components/ui/SavedViews";
import { StatTile } from "@/components/ui/StatTile";
import { formatMoneyCompact } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethodView, paymentMethodTotals, paymentRows } from "@/lib/mock/selectors-billing";

export const metadata = { title: "Payments · Brightloop" };

export default function Page(props: PageProps<"/payments">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1440px] animate-pulse px-8 py-8" />}>
      <Payments {...props} />
    </Suspense>
  );
}

async function Payments({ searchParams }: PageProps<"/payments">) {
  const sp = await searchParams;
  const param = typeof sp.method === "string" ? sp.method : "all";
  const method: PaymentMethodView = (PAYMENT_METHODS as string[]).includes(param) ? (param as PaymentMethodView) : "all";

  const totals = paymentMethodTotals();
  const rows = paymentRows(method);
  const shown = rows.reduce((n, r) => n + r.amount, 0);

  const views: SavedView[] = [
    { key: "all", label: "All", href: "/payments" },
    ...totals.methods.map((m) => ({ key: m.method, label: METHOD_LABEL[m.method], href: `/payments?method=${m.method}` })),
  ];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<CreditCard />}
            title={`${rows.length} ${rows.length === 1 ? "payment" : "payments"}`}
            subtitle={`${formatMoneyCompact(shown)} received${method === "all" ? "" : ` by ${METHOD_LABEL[method]}`}`}
          />
          <SavedViews views={views} active={method} aria-label="Payment methods" />
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile index={0} label="Total received" value={totals.total} format="compact" delta={`${totals.count} payments`} />
          {totals.methods.map((m, i) => (
            <StatTile
              key={m.method}
              index={i + 1}
              label={METHOD_LABEL[m.method]}
              value={m.amount}
              format="compact"
              delta={`${m.count} ${m.count === 1 ? "payment" : "payments"}${totals.total ? ` · ${Math.round((m.amount / totals.total) * 100)}%` : ""}`}
            />
          ))}
        </div>
        <div className="min-h-0 flex-1">
          <PaymentsTable key={method} rows={rows} />
        </div>
      </div>
    </PageGrid>
  );
}
