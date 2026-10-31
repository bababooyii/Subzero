import { UsersView } from "@/components/settings/UsersView";
import { listUsers } from "@/lib/mock/selectors";

export const metadata = { title: "Settings · Brightloop" };

export default function Page() {
  return <UsersView initial={listUsers().filter((u) => u.role !== "customer")} />;
}
