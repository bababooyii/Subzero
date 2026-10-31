import { AppShell } from "@/components/shell/AppShell";
import { searchIndex, sidebarCounts } from "@/lib/mock/selectors";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell counts={sidebarCounts()} index={searchIndex()}>
      {children}
    </AppShell>
  );
}
