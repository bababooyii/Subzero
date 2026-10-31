import { Suspense } from "react";
import { AdminGate } from "@/components/catalog/AdminGate";

/** Catalog pages are listed in the sidebar, so the layout only gates them to admins (the session is read per request). */
export default function CatalogLayout({ children }: LayoutProps<"/catalog">) {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
