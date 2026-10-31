import { cn } from "@/helpers/classname-helper";
import { checkPassword, passwordRules } from "@/lib/auth/password";

/** True when `password` meets every rule (same rules the server enforces). */
export const passwordOk = (password: string) => checkPassword(password).ok;

/** Live checklist of the password rules. */
export function PasswordRules({ password, id = "password-rules" }: { password: string; id?: string }) {
  const failed = new Set<string>(checkPassword(password).failed);
  return (
    <ul id={id} className="mt-1 space-y-1.5" aria-label="Password rules">
      {passwordRules.map((r) => {
        const ok = !failed.has(r.id);
        return (
          <li key={r.id} className={cn("flex items-center gap-2 text-[12px] transition-colors", ok ? "text-text" : "text-muted")}>
            <input type="checkbox" checked={ok} readOnly tabIndex={-1} aria-hidden="true" className="pointer-events-none size-4" />
            <span>
              {r.label}
              <span className="sr-only">{ok ? " (met)" : " (not met)"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
