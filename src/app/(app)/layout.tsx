import { Suspense, type ReactNode } from "react";
import { db } from "@/db/client";
import { AppShell } from "@/components/shell/AppShell";
import { requireStaffUser } from "@/components/shell/guard";
import { todayIST } from "@/lib/dates";
import { navCounts } from "@/features/dashboard/queries";

async function Frame({ children }: { children: ReactNode }) {
  const user = await requireStaffUser();
  const counts = await navCounts(db, todayIST());
  return (
    <AppShell role={user.role} user={{ name: user.name, email: user.email }} counts={{ dueToday: counts.dueToday, overdue: counts.overdueInvoices }}>
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={null}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}
