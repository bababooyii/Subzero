"use client";

import { useState } from "react";
import { PasswordRules, passwordOk } from "@/components/auth/PasswordRules";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { createStaffUser } from "@/features/users/actions";
import { btnPrimary, btnSecondary } from "@/lib/ui";
import type { TeamUser } from "./users-source";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: TeamUser[];
  /** Called after the staff user was created (the parent refreshes the list). */
  onAdded: (name: string) => void;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Form({ existing, onAdded, onOpenChange }: Omit<Props, "open">) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const trimmed = email.trim().toLowerCase();
  const taken = trimmed !== "" && existing.some((u) => u.email.toLowerCase() === trimmed);
  const emailBad = trimmed !== "" && !EMAIL.test(trimmed);
  const valid = name.trim() !== "" && trimmed !== "" && !emailBad && !taken && passwordOk(password);

  const submit = async () => {
    if (!valid || pending) return;
    setPending(true);
    setFieldErrors({});
    const res = await createStaffUser({ name: name.trim(), email: trimmed, password });
    setPending(false);
    if (!res.ok) {
      setFieldErrors(res.fieldErrors ?? {});
      toast(res.error);
      return;
    }
    onAdded(name.trim());
    onOpenChange(false);
  };

  const err = (key: string) => fieldErrors[key]?.[0];

  return (
    <DialogContent
      title="Add staff"
      description="They get access to billing. Catalog and settings stay with admins."
      footer={
        <>
          <DialogClose className={btnSecondary}>Cancel</DialogClose>
          <button type="button" className={btnPrimary} onClick={submit} disabled={!valid || pending}>
            Add staff
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Name" htmlFor="staff-name" hint={err("name") ? <span className="text-danger">{err("name")}</span> : undefined}>
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
            ) : err("email") ? (
              <span className="text-danger">{err("email")}</span>
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
        <Field label="Temporary password" htmlFor="staff-password" hint={err("password") ? <span className="text-danger">{err("password")}</span> : undefined}>
          <Input
            id="staff-password"
            type="password"
            autoComplete="new-password"
            aria-describedby="staff-password-rules"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordRules password={password} id="staff-password-rules" />
        </Field>
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Add staff
        </button>
      </form>
    </DialogContent>
  );
}

/** Admin-only dialog (the parent doesn't render it for staff). Creates the staff user through `createStaffUser`. */
export function AddStaffDialog({ open, onOpenChange, existing, onAdded }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <Form existing={existing} onAdded={onAdded} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}
