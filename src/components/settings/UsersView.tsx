"use client";

import { Plus, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { useRole } from "@/components/shell/role";
import { HoldDelete } from "@/components/catalog/HoldDelete";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { cn } from "@/helpers/classname-helper";
import type { User } from "@/lib/mock/types";
import { btnPrimary, hint, surface } from "@/lib/ui";
import { AddStaffDialog } from "./AddStaffDialog";

const ROLE_LABEL: Record<User["role"], string> = {
  admin: "Admin",
  staff: "Staff",
  customer: "Customer",
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Team list with roles. Only admins see Add staff and remove. Changes are local state only. */
export function UsersView({ initial }: { initial: User[] }) {
  const { role } = useRole();
  const isAdmin = role === "admin";
  const [users, setUsers] = useState(initial);
  const [adding, setAdding] = useState(false);

  const admins = users.filter((u) => u.role === "admin").length;

  const add = (user: User) => {
    setUsers((us) => [...us, user]);
    toast.undo(`Added ${user.name} as ${ROLE_LABEL[user.role].toLowerCase()}`, () =>
      setUsers((us) => us.filter((u) => u.id !== user.id)),
    );
  };

  const remove = (user: User) => {
    setUsers((us) => us.filter((u) => u.id !== user.id));
    toast(`Removed ${user.name}`);
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
          {isAdmin ? (
            <button type="button" className={btnPrimary} onClick={() => setAdding(true)}>
              <Plus size={14} strokeWidth={2.5} /> Add staff
            </button>
          ) : null}
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <h2 className="shrink-0 text-[13px] font-medium text-text">Team</h2>
        {isAdmin ? null : <p className={cn(hint, "shrink-0")}>Only admins can add or remove staff.</p>}
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
                  {isAdmin && u.role !== "admin" ? (
                    <HoldDelete label={u.name} onConfirm={() => remove(u)} />
                  ) : (
                    <span className="size-8 shrink-0" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </ScrollPanel>
        </div>
        {isAdmin ? (
          <p className={cn(hint, "shrink-0")}>
            Use the bin to remove a staff member. Admins cannot be removed here.
          </p>
        ) : null}
      </div>
      {isAdmin ? <AddStaffDialog open={adding} onOpenChange={setAdding} existing={users} onAdd={add} /> : null}
    </PageGrid>
  );
}
