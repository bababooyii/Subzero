"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { toast } from "@/components/ui/toast";
import { updateMyContactAction } from "@/features/portal/actions";
import { formatDateLong } from "@/lib/format";
import { btnPrimary, btnSecondary, hint, sectionTitle, surface } from "@/lib/ui";
import type { PortalCustomer } from "./types";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] break-words text-text">{children}</dd>
    </div>
  );
}

/**
 * Profile and billing contact, read from the signed-in customer's record. The contact is a small form that saves through
 * `updateMyContactAction`; company facts are read-only.
 */
export function PortalAccount({ customer }: { customer: PortalCustomer }) {
  const [contact, setContact] = useState({ contactName: customer.contactName, email: customer.email, phone: customer.phone });
  const [saved, setSaved] = useState(contact);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();
  const dirty = contact.contactName !== saved.contactName || contact.email !== saved.email || contact.phone !== saved.phone;
  const valid = contact.contactName.trim() !== "" && /^\S+@\S+\.\S+$/.test(contact.email);
  const set = (key: keyof typeof contact) => (e: React.ChangeEvent<HTMLInputElement>) => setContact((c) => ({ ...c, [key]: e.target.value }));

  async function save() {
    setSaving(true);
    try {
      // The address is not editable here, but the action replaces it, so send the current one back.
      const res = await updateMyContactAction({ name: contact.contactName, email: contact.email, phone: contact.phone, address: customer.address });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast(res.error);
        return;
      }
      setErrors({});
      setSaved(contact);
      toast("Billing contact saved.");
      router.refresh();
    } catch {
      toast("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageGrid
      left={
        <>
          <Intro icon={<User />} title="Your account" subtitle={customer.name} />
          <Link href="/login" className={btnSecondary}>
            Sign out
          </Link>
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
        <form
          className={`${surface} flex min-h-0 min-w-0 animate-rise flex-col gap-6 self-start p-5`}
          onSubmit={(e) => {
            e.preventDefault();
            if (!dirty || !valid || saving) return;
            void save();
          }}
        >
          <div>
            <h2 className={sectionTitle}>Billing contact</h2>
            <p className={`${hint} mt-1`}>Invoices and payment reminders go to this person.</p>
          </div>
          <Field label="Contact name" htmlFor="acc-name" hint={errors.name ? <span className="text-danger">{errors.name[0]}</span> : undefined}>
            <Input id="acc-name" value={contact.contactName} onChange={set("contactName")} autoComplete="name" />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Email" htmlFor="acc-email" hint={errors.email ? <span className="text-danger">{errors.email[0]}</span> : undefined}>
              <Input id="acc-email" type="email" value={contact.email} onChange={set("email")} autoComplete="email" />
            </Field>
            <Field label="Phone" htmlFor="acc-phone">
              <Input id="acc-phone" type="tel" value={contact.phone} onChange={set("phone")} autoComplete="tel" />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className={hint}>To change company or GSTIN details, contact Brightloop billing support.</p>
            <button type="submit" className={btnPrimary} disabled={!dirty || !valid || saving}>
              Save changes
            </button>
          </div>
        </form>

        <aside className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className={`${surface} shrink-0 animate-rise p-4`} style={{ animationDelay: "60ms" }}>
            <h2 className={`${sectionTitle} mb-1`}>Company</h2>
            <dl className="divide-y divide-white/[0.05]">
              <Fact label="Company">{customer.name}</Fact>
              <Fact label="Address">{customer.address || "—"}</Fact>
              <Fact label="GSTIN">
                <span className="tabular-nums">{customer.gstin || "—"}</span>
              </Fact>
              <Fact label="Customer since">{formatDateLong(customer.createdAt)}</Fact>
            </dl>
          </div>
        </aside>
      </div>
    </PageGrid>
  );
}
