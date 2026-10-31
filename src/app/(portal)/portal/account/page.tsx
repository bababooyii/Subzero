import { Suspense } from "react";
import { PortalAccount } from "@/components/portal/PortalAccount";
import { getPortalData } from "@/components/portal/load";

export const metadata = { title: "Account · Brightloop" };

export default function Page() {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { customer } = await getPortalData();
  return <PortalAccount customer={customer} />;
}
