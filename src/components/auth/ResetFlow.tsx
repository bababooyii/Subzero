"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { AuthCard } from "@/components/shell/AuthCard";
import { btnPrimary, btnSecondary, iconTile } from "@/lib/ui";
import { SubmitButton } from "./SubmitButton";
import { useFakeSubmit } from "./useFakeSubmit";

const back = (
  <Link href="/login" className="text-text hover:underline">
    Back to sign in
  </Link>
);

export function ResetFlow() {
  const { pending, run } = useFakeSubmit();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    run(() => setSent(true));
  }

  if (sent) {
    return (
      <AuthCard title="Check your inbox" subtitle={`We sent a password reset link to ${email.trim()}.`} footer={back}>
        <div className="space-y-4">
          <div className={`${iconTile.base} ${iconTile.success} animate-pop`}>
            <MailCheck className="size-6" aria-hidden="true" />
          </div>
          <p className="text-[12px] text-muted">The link works for 30 minutes. Not there? Check your spam folder.</p>
          <div className="flex flex-col gap-2">
            <Link href="/login" className={`${btnPrimary} w-full`}>
              Back to sign in
            </Link>
            <button type="button" className={`${btnSecondary} w-full`} onClick={() => setSent(false)}>
              Use a different email
            </button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset your password" subtitle="We will email you a link to set a new one." footer={back}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
          {error ? (
            <p role="alert" className="text-[12px] text-danger">
              {error}
            </p>
          ) : null}
        </Field>
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
