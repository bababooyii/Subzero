import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Intro } from "@/components/ui/Intro";
import { getSession, hasRole } from "@/lib/auth/session";
import { surface } from "@/lib/ui";

/** The catalog is for admins. Staff who reach it by URL get a short explanation instead. Reads the session on the server. */
export async function AdminGate({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!hasRole(session?.user, "admin")) {
    return (
      <div className="px-5 pb-6 sm:px-8 fit:h-full">
        <div className={`${surface} grid min-h-72 place-items-center p-8 fit:h-full`}>
          <Intro
            centered
            tone="danger"
            icon={<Lock />}
            title="Admins only"
            subtitle="The catalog is managed by admins. Ask an admin if something needs to change."
          />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
