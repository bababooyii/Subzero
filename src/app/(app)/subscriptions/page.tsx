import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SubscriptionsTable } from "@/components/subscriptions/SubscriptionsTable";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { SavedViews } from "@/components/ui/SavedViews";
import { formatMoneyCompact } from "@/lib/format";
import {
  SUBSCRIPTION_VIEWS,
  parseSubscriptionView,
  subscriptionRows,
  subscriptionViewCounts,
  totalMrr,
} from "@/lib/mock/selectors-subscriptions";
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
  quotation: { title: "No quotations waiting", subtitle: "Send a quotation from a draft to see it here." },
  paused: { title: "Nothing is paused", subtitle: "Paused subscriptions land here." },
  closing: { title: "Nothing closing soon", subtitle: "No active subscription expires within 30 days." },
  due: { title: "You're all caught up!", subtitle: "Nothing is due to bill today." },
};

async function Subscriptions({ searchParams }: PageProps<"/subscriptions">) {
  const sp = await searchParams;
  const view = parseSubscriptionView(typeof sp.view === "string" ? sp.view : undefined);
  const rows = subscriptionRows(view);
  const counts = subscriptionViewCounts();
  const current = SUBSCRIPTION_VIEWS.find((v) => v.key === view)!;
  const empty = EMPTY[view];

  return (
    <PageGrid
      width="wide"
      left={
        <>
          <Intro
            icon={<RefreshCw />}
            title={`${rows.length} ${view === "all" ? "subscriptions" : current.label.toLowerCase()}`}
            subtitle={rows.length ? `${formatMoneyCompact(totalMrr(rows))} MRR in this view` : current.description}
          />
          <SavedViews
            aria-label="Subscription views"
            active={view}
            views={SUBSCRIPTION_VIEWS.map((v) => ({
              key: v.key,
              label: v.label,
              href: v.key === "all" ? "/subscriptions" : `/subscriptions?view=${v.key}`,
              count: v.key === "due" ? counts.due : undefined,
            }))}
          />
          <Link href="/subscriptions/new" className={btnPrimary}>
            <Plus size={14} strokeWidth={2.5} /> New subscription
          </Link>
        </>
      }
    >
      <SubscriptionsTable key={view} rows={rows} emptyTitle={empty?.title} emptySubtitle={empty?.subtitle} />
    </PageGrid>
  );
}
