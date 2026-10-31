"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { AuthCard } from "@/components/shell/AuthCard";
import { authClient } from "./auth-client";
import { SubmitButton } from "./SubmitButton";
import { usePending } from "./usePending";

type Props = {
  /** Seeded demo logins: the buttons below fill in the email. */
  adminDemo: string;
  staffDemo: string;
  customerDemo: string;
};

export function LoginForm({ adminDemo, staffDemo, customerDemo }: Props) {
  const router = useRouter();
  const { pending, run } = usePending();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError("");
    void run(async () => {
      const { data, error: err } = await authClient.signIn.email({ email: email.trim(), password });
      if (err || !data) {
        setError(err?.message || "Email or password is incorrect.");
        return;
      }
      // The session's role decides where they land; the (app) layout sends customers to the portal anyway.
      const role = (data.user as { role?: string }).role;
      router.push(role === "customer" ? "/portal" : "/dashboard");
      router.refresh();
    });
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to Brightloop."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="text-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            placeholder="you@company.in"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint={
            <Link href="/reset" className="hover:text-text">
              Forgot your password?
            </Link>
          }
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-[12px] text-danger">
            {error}
          </p>
        ) : null}
        <SubmitButton pending={pending} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      <div className="mt-5 border-t border-white/[0.06] pt-4 text-[12px] text-muted">
        <p>Demo accounts</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <button
            type="button"
            className="cursor-pointer hover:text-text"
            onClick={() => {
              setEmail(adminDemo);
              setPassword("");
            }}
          >
            Sign in as admin
          </button>
          <button
            type="button"
            className="cursor-pointer hover:text-text"
            onClick={() => {
              setEmail(staffDemo);
              setPassword("");
            }}
          >
            Sign in as staff
          </button>
          <button
            type="button"
            className="cursor-pointer hover:text-text"
            onClick={() => {
              setEmail(customerDemo);
              setPassword("");
            }}
          >
            Sign in as a customer
          </button>
        </div>
      </div>
    </AuthCard>
  );
}
