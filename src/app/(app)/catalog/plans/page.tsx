import { Suspense } from "react";
import { PlansView } from "@/components/catalog/PlansView";
import { db } from "@/db/client";
import { listPlans } from "@/features/catalog/queries";
import { requestToday } from "@/lib/request-today";
import { planStats } from "./plan-stats";

export const metadata = { title: "Plans · Brightloop" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Plans />
    </Suspense>
  );
}

async function Plans() {
  const today = await requestToday();
  // Plans are a card grid that pages itself, so it loads them all (there are only a handful).
  const { rows } = await listPlans(db, { active: true, pageSize: 200 });
  const stats = await planStats(db, rows.map((p) => p.id), today);
  return <PlansView plans={rows} stats={stats} today={today} />;
}
