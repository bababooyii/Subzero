import { redirect } from "next/navigation";
import { requireStaffUser } from "@/components/shell/guard";
import { UsersView } from "@/components/settings/UsersView";
import { listTeam } from "@/components/settings/users-source";

export const metadata = { title: "Settings · Brightloop" };

export default async function Page() {
  const user = await requireStaffUser();
  if (user.role !== "admin") redirect("/dashboard");
  return <UsersView initial={await listTeam()} />;
}
