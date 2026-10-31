import type { ReactNode } from "react";
import { cn } from "@/helpers/classname-helper";
import { btnPrimary } from "@/lib/ui";
import { LogoTraceLoader } from "./LogoTraceLoader";

type Props = { pending: boolean; pendingLabel: string; disabled?: boolean; children: ReactNode };

/** The one white button of an auth form. Shows the traced-logo loader while the fake submit is in flight. */
export function SubmitButton({ pending, pendingLabel, disabled, children }: Props) {
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={cn(btnPrimary, "w-full")}>
      {pending ? (
        <>
          <LogoTraceLoader size={16} ariaLabel={pendingLabel} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
