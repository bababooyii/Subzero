import { Suspense } from "react";
import { BillingRun } from "@/components/billing/BillingRun";
import { loadDrafts } from "./drafts";

export const metadata = { title: "Billing run · Brightloop" };

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1440px] animate-pulse px-8 py-8" />}>
      <Run />
    </Suspense>
  );
}

async function Run() {
  const { drafts, error } = await loadDrafts();
  return <BillingRun initial={drafts} loadError={error} />;
}
