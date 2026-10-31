import { Suspense } from "react";
import { PortalLoader } from "@/components/portal/PortalLoader";

/** The customer's data lives in one client provider for every portal page (lists, records, the Pay dialog). */
export default function PortalDataLayout({ children }: LayoutProps<"/portal">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <PortalLoader>{children}</PortalLoader>
    </Suspense>
  );
}
