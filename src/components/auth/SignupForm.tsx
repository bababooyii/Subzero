"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { AuthCard } from "@/components/shell/AuthCard";
import { cn } from "@/helpers/classname-helper";
import { SubmitButton } from "./SubmitButton";
import { useFakeSubmit } from "./useFakeSubmit";

export const PASSWORD_RULES = [
  { key: "length", label: "More than 8 characters", test: (p: string) => p.length > 8 },
  { key: "upper", label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { key: "special", label: "A special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm({ registeredEmails }: { registeredEmails: string[] }) {
  const router = useRouter();
  const { pending, run } = useFakeSubmit();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const normalised = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(normalised);
  const taken = emailValid && registeredEmails.includes(normalised);
  const results = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const passwordOk = results.every((r) => r.ok);
  const canSubmit = name.trim().length > 0 && emailValid && !taken && passwordOk;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    run(() => {
      toast("Account created. Welcome to Brightloop.");
      router.push("/portal");
    });
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Customers sign up here to manage their subscriptions."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="name">
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={taken || undefined}
            aria-describedby={taken ? "email-error" : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {taken ? (
            <p id="email-error" role="alert" className="text-[12px] text-danger">
              This email is already registered.{" "}
              <Link href="/login" className="underline">
                Sign in instead
              </Link>
            </p>
          ) : null}
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-describedby="password-rules"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <ul id="password-rules" className="mt-1 space-y-1.5" aria-label="Password rules">
            {results.map((r) => (
              <li key={r.key} className={cn("flex items-center gap-2 text-[12px] transition-colors", r.ok ? "text-text" : "text-muted")}>
                <input type="checkbox" checked={r.ok} readOnly tabIndex={-1} aria-hidden="true" className="pointer-events-none size-4" />
                <span>
                  {r.label}
                  <span className="sr-only">{r.ok ? " (met)" : " (not met)"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Field>
        <SubmitButton pending={pending} pendingLabel="Creating account…" disabled={!canSubmit}>
          Create account
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
