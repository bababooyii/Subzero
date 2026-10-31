"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { AuthCard } from "@/components/shell/AuthCard";
import { toast } from "@/components/ui/toast";
import { btnPrimary, btnSecondary, iconTile } from "@/lib/ui";
import { authClient } from "./auth-client";
import { PasswordRules, passwordOk } from "./PasswordRules";
import { SubmitButton } from "./SubmitButton";
import { usePending } from "./usePending";

const back = (
  <Link href="/login" className="text-text hover:underline">
    Back to sign in
  </Link>
);

/** Step 2: the emailed link lands on /reset?token=...; choose a new password. */
function NewPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { pending, run } = usePending();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordOk(password)) return;
    setError("");
    void run(async () => {
      const { error: err } = await authClient.resetPassword({ newPassword: password, token });
      if (err) {
        setError(err.message || "This reset link is invalid or has expired.");
        return;
      }
      toast("Password updated. Sign in with your new password.");
      router.push("/login");
    });
  }

  return (
    <AuthCard title="Choose a new password" subtitle="Pick something you have not used before." footer={back}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="new-password">
          <Input
            id="new-password"
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
        <SubmitButton pending={pending} pendingLabel="Saving…" disabled={!passwordOk(password)}>
          Update password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

export function ResetFlow() {
  const token = useSearchParams().get("token");
  return token ? <NewPasswordForm token={token} /> : <RequestForm />;
}

function RequestForm() {
  const { pending, run } = usePending();
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
    void run(async () => {
      const { error: err } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset" });
      if (err) {
        setError(err.message || "Could not send the reset link. Try again.");
        return;
      }
      setSent(true);
    });
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
