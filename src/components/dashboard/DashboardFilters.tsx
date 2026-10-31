"use client";

import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/ui/Dropdown";
import { PillSwitch } from "@/components/ui/PillSwitch";

type Props = { plans: { id: string; name: string }[]; plan: string; months: number };

/** Period switch and plan filter for the dashboard header. State lives in the URL. */
export function DashboardFilters({ plans, plan, months }: Props) {
  const router = useRouter();
  const go = (next: { plan?: string; months?: number }) => {
    const p = next.plan ?? plan;
    const m = next.months ?? months;
    const qs = new URLSearchParams();
    if (p) qs.set("plan", p);
    if (m !== 6) qs.set("months", String(m));
    router.replace(`/dashboard${qs.size ? `?${qs}` : ""}`, { scroll: false });
  };
  return (
    <>
      <PillSwitch
        aria-label="Period"
        value={String(months)}
        onChange={(k) => go({ months: Number(k) })}
        options={[
          { key: "3", label: "3 months" },
          { key: "6", label: "6 months" },
        ]}
      />
      <Dropdown
        aria-label="Plan"
        className="w-44"
        align="end"
        value={plan}
        onChange={(v) => go({ plan: v })}
        options={[{ value: "", label: "All plans" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]}
      />
    </>
  );
}
