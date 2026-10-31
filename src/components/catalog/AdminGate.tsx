"use client";

import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Intro } from "@/components/ui/Intro";
import { useRole } from "@/components/shell/role";
import { surface } from "@/lib/ui";

/** The catalog is for admins. Staff who reach it by URL get a short explanation instead. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { role } = useRole();
  if (role !== "admin") {
    return (
      <div className="px-5 pb-6 sm:px-8 fit:h-full">
        <div className={`${surface} grid min-h-72 place-items-center p-8 fit:h-full`}>
          <Intro
            centered
            tone="danger"
            icon={<Lock />}
            title="Admins only"
            subtitle="The catalog is managed by admins. Switch to the admin role to edit it."
          />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
