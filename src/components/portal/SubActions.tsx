"use client";

import { Pause, Play, X } from "lucide-react";
import { useState } from "react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { toast } from "@/components/ui/toast";
import { btnSecondary } from "@/lib/ui";
import type { PortalSub } from "./types";

type Props = {
  sub: Pick<PortalSub, "id" | "number" | "canPause" | "canResume" | "canCancel">;
  onPause: () => Promise<boolean>;
  onResume: () => Promise<boolean>;
  onCancel: () => Promise<boolean>;
};

/**
 * Pause / Resume / Cancel for a customer's own subscription (header toolbar). Each only appears when the server says
 * it is allowed (plan flags and status). Pause and resume are reversible (Undo toast calls the inverse action);
 * cancelling asks for confirmation first.
 */
export function SubActions({ sub, onPause, onResume, onCancel }: Props) {
  const [busy, setBusy] = useState(false);

  async function guard(fn: () => Promise<boolean>) {
    if (busy) return false;
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  const resume = async () => {
    if (await guard(onResume)) toast.undo(`Resumed ${sub.number}.`, () => void pause(true));
  };
  const pause = async (silent = false) => {
    if (await guard(onPause) && !silent) toast.undo(`Paused ${sub.number}. Billing stops until you resume.`, () => void resume());
  };

  const cancel = async () => {
    if (await guard(onCancel)) toast(`${sub.number} cancelled.`);
  };

  return (
    <>
      {sub.canPause ? (
        <button type="button" className={btnSecondary} disabled={busy} onClick={() => void pause()}>
          <Pause size={13} strokeWidth={2.5} aria-hidden="true" /> Pause
        </button>
      ) : null}
      {sub.canResume ? (
        <button type="button" className={btnSecondary} disabled={busy} onClick={() => void resume()}>
          <Play size={13} strokeWidth={2.5} aria-hidden="true" /> Resume
        </button>
      ) : null}
      {sub.canCancel ? (
        <ConfirmButton
          title={`Cancel ${sub.number}?`}
          description="You will not be billed again. This cannot be undone from the portal."
          confirmLabel={
            <>
              <X size={13} strokeWidth={2.5} aria-hidden="true" /> Cancel subscription
            </>
          }
          onConfirm={() => void cancel()}
        >
          <X size={13} strokeWidth={2.5} aria-hidden="true" /> Cancel
        </ConfirmButton>
      ) : null}
    </>
  );
}
