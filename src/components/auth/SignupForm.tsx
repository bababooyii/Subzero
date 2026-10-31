"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/components/ui/toast";
import { AuthCard } from "@/components/shell/AuthCard";
import { authClient } from "./auth-client";
import { PasswordRules, passwordOk } from "./PasswordRules";
import { SubmitButton } from "./SubmitButton";
import { usePending } from "./usePending";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const router = useRouter();
  const { pending, run } = usePending();
  const [taken, setTaken] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const normalised = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(normalised);
  const isTaken = emailValid && taken === normalised;
  const canSubmit = name.trim().length > 0 && emailValid && !isTaken && passwordOk(password);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    void run(async () => {
      const { error: err } = await authClient.signUp.email({ name: name.trim(), email: normalised, password });
      if (err) {
        if (err.code === "USER_ALREADY_EXISTS" || /already/i.test(err.message ?? "")) setTaken(normalised);
        else setError(err.message || "Could not create your account.");
        return;
      }
      toast("Account created. Welcome to Brightloop.");
      router.push("/portal");
      router.refresh();
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
            aria-invalid={isTaken || undefined}
            aria-describedby={isTaken ? "email-error" : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {isTaken ? (
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
          <PasswordRules password={password} />
        </Field>
        {error ? (
          <p role="alert" className="text-[12px] text-danger">
            {error}
          </p>
        ) : null}
        <SubmitButton pending={pending} pendingLabel="Creating account…" disabled={!canSubmit}>
          Create account
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
