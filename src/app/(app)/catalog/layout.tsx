import { AdminGate } from "@/components/catalog/AdminGate";

/** Catalog pages are listed in the sidebar, so the layout only gates them to admins. */
export default function CatalogLayout({ children }: LayoutProps<"/catalog">) {
  return <AdminGate>{children}</AdminGate>;
}
