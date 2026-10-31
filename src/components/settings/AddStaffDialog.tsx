"use client";

import { useState } from "react";
import { localId } from "@/components/catalog/form-utils";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import type { User } from "@/lib/mock/types";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: User[];
  onAdd: (user: User) => void;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Form({ existing, onAdd, onOpenChange }: Omit<Props, "open">) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");

  const trimmed = email.trim().toLowerCase();
  const taken = trimmed !== "" && existing.some((u) => u.email.toLowerCase() === trimmed);
  const emailBad = trimmed !== "" && !EMAIL.test(trimmed);
  const valid = name.trim() !== "" && trimmed !== "" && !emailBad && !taken;

  const submit = () => {
    if (!valid) return;
    onAdd({ id: localId("u"), name: name.trim(), email: trimmed, role });
    onOpenChange(false);
  };

  return (
    <DialogContent
      title="Add staff"
      description="They get access to billing. Admins also manage the catalog and settings."
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={submit} disabled={!valid}>
            Add staff
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Name" htmlFor="staff-name">
          <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Nair" autoFocus />
        </Field>
        <Field
          label="Email"
          htmlFor="staff-email"
          hint={
            taken ? (
              <span className="text-danger">This email is already registered.</span>
            ) : emailBad ? (
              <span className="text-danger">Enter a valid email address.</span>
            ) : undefined
          }
        >
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="priya@brightloop.test"
          />
        </Field>
        <Field label="Role" htmlFor="staff-role">
          <Dropdown
            id="staff-role"
            value={role}
            onChange={(v) => setRole(v as "staff" | "admin")}
            options={[
              { value: "staff", label: "Staff" },
              { value: "admin", label: "Admin" },
            ]}
          />
        </Field>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Add staff
        </button>
      </form>
    </DialogContent>
  );
}

/** Admin-only dialog (the parent doesn't render it for staff). Mock: adds to local state with an Undo toast. */
export function AddStaffDialog({ open, onOpenChange, existing, onAdd }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <Form existing={existing} onAdd={onAdd} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}
