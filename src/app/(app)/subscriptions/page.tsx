import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SubscriptionsTable } from "@/components/subscriptions/SubscriptionsTable";
import { SUBSCRIPTION_VIEWS, parseSubscriptionView } from "@/components/subscriptions/rows";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews } from "@/components/ui/SavedViews";
import { db } from "@/db/client";
import { listSubscriptions, subscriptionCounts } from "@/features/subscriptions/queries";
import { requestToday } from "@/lib/request-today";
import { formatNumber } from "@/lib/format";
import { readPaging } from "@/lib/table-params";
import { btnPrimary } from "@/lib/ui";

export const metadata = { title: "Subscriptions · Brightloop" };

export default function SubscriptionsPage(props: PageProps<"/subscriptions">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1440px] animate-pulse px-8 py-8" />}>
      <Subscriptions {...props} />
    </Suspense>
  );
}

const EMPTY: Record<string, { title: string; subtitle: string }> = {
  quotations: { title: "No quotations waiting", subtitle: "Send a quotation from a draft to see it here." },
  paused: { title: "Nothing is paused", subtitle: "Paused subscriptions land here." },
  closing_this_month: { title: "Nothing closing soon", subtitle: "No subscription expires this month." },
  due_today: { title: "You're all caught up!", subtitle: "Nothing is due to bill today." },
};

async function Subscriptions({ searchParams }: PageProps<"/subscriptions">) {
  const sp = await searchParams;
  const view = parseSubscriptionView(typeof sp.view === "string" ? sp.view : undefined);
  const today = await requestToday();
  const [list, counts] = await Promise.all([
    listSubscriptions(db, { ...readPaging(sp), view, today }),
    subscriptionCounts(db, today),
  ]);
  const current = SUBSCRIPTION_VIEWS.find((v) => v.key === view)!;
  const empty = EMPTY[view];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<RefreshCw />}
            title={`${formatNumber(list.total)} ${view === "all" ? "subscriptions" : current.label.toLowerCase()}`}
            subtitle={current.description}
          />
          <SavedViews
            aria-label="Subscription views"
            active={view}
            views={SUBSCRIPTION_VIEWS.map((v) => ({
              key: v.key,
              label: v.label,
              href: v.key === "all" ? "/subscriptions" : `/subscriptions?view=${v.key}`,
              count: v.key === "due_today" ? counts.dueToday : undefined,
            }))}
          />
          <Link href="/subscriptions/new" className={btnPrimary}>
            <Plus size={14} strokeWidth={2.5} /> New subscription
          </Link>
        </>
      }
    >
      <SubscriptionsTable
        key={view}
        rows={list.rows}
        paging={{ total: list.total, page: list.page, pageSize: list.pageSize }}
        emptyTitle={empty?.title}
        emptySubtitle={empty?.subtitle}
      />
    </PageGrid>
  );
}
