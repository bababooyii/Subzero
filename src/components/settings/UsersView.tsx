"use client";

import { Plus, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { cn } from "@/helpers/classname-helper";
import { btnPrimary, surface } from "@/lib/ui";
import { AddStaffDialog } from "./AddStaffDialog";
import type { TeamUser } from "./users-source";

const ROLE_LABEL: Record<TeamUser["role"], string> = {
  admin: "Admin",
  staff: "Staff",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Team list with roles. The Settings page is admin-only, so everything here is for admins. */
export function UsersView({ initial }: { initial: TeamUser[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const users = initial;

  const admins = users.filter((u) => u.role === "admin").length;

  // No inverse action exists for creating a user, so a plain toast (no Undo).
  const added = (name: string) => {
    toast(`Added ${name} as staff`);
    router.refresh();
  };

  return (
    <PageGrid
      width="form"
      left={
        <>
          <Intro
            icon={<Users />}
            title="Users & staff"
            subtitle={`${users.length} member${users.length === 1 ? "" : "s"} · ${admins} admin${admins === 1 ? "" : "s"}`}
          />
          <button type="button" className={btnPrimary} onClick={() => setAdding(true)}>
            <Plus size={14} strokeWidth={2.5} /> Add staff
          </button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <h2 className="shrink-0 text-[13px] font-medium text-text">Team</h2>
        <div className={cn(surface, "flex min-h-0 flex-col overflow-hidden")}>
          <ScrollPanel>
            <ul className="divide-y divide-white/[0.05]" aria-label="Team">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-medium text-text"
                  >
                    {initials(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-text">{u.name}</span>
                    <span className="block truncate text-[12px] text-muted">{u.email}</span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]",
                      u.role === "admin" ? "bg-white/10 text-text" : "border border-white/[0.07] text-muted",
                    )}
                  >
                    {u.role === "admin" ? <ShieldCheck size={12} aria-hidden="true" /> : null}
                    {ROLE_LABEL[u.role]}
                  </span>
                  {/* TODO(backend): removing a staff member has no action yet, so no bin. */}
                </li>
              ))}
            </ul>
          </ScrollPanel>
        </div>
      </div>
      <AddStaffDialog open={adding} onOpenChange={setAdding} existing={users} onAdded={added} />
    </PageGrid>
  );
}
