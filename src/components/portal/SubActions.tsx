"use client";

import { Pause, Play, X } from "lucide-react";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { toast } from "@/components/ui/toast";
import { btnSecondary } from "@/lib/ui";
import type { PortalSub } from "@/lib/mock/selectors-portal";
import type { SubscriptionStatus } from "@/lib/mock/types";

type Props = {
  sub: Pick<PortalSub, "number" | "status" | "pausable" | "closable">;
  onStatus: (status: SubscriptionStatus) => void;
};

/**
 * Pause / Resume / Cancel for a customer's own subscription (header toolbar). Each only appears when the plan allows it.
 * Pause and resume are reversible (Undo toast); cancelling asks for confirmation first.
 */
export function SubActions({ sub, onStatus }: Props) {
  const { status } = sub;

  const pause = () => {
    onStatus("paused");
    toast.undo(`Paused ${sub.number}. Billing stops until you resume.`, () => onStatus("active"));
  };
  const resume = () => {
    onStatus("active");
    toast.undo(`Resumed ${sub.number}.`, () => onStatus("paused"));
  };

  const canPause = sub.pausable && status === "active";
  const canResume = sub.pausable && status === "paused";
  const canCancel = sub.closable && (status === "active" || status === "paused");

  return (
    <>
      {canPause ? (
        <button type="button" className={btnSecondary} onClick={pause}>
          <Pause size={13} strokeWidth={2.5} aria-hidden="true" /> Pause
        </button>
      ) : null}
      {canResume ? (
        <button type="button" className={btnSecondary} onClick={resume}>
          <Play size={13} strokeWidth={2.5} aria-hidden="true" /> Resume
        </button>
      ) : null}
      {canCancel ? (
        <ConfirmButton
          title={`Cancel ${sub.number}?`}
          description="You will not be billed again. This cannot be undone from the portal."
          confirmLabel={
            <>
              <X size={13} strokeWidth={2.5} aria-hidden="true" /> Cancel subscription
            </>
          }
          onConfirm={() => {
            onStatus("closed");
            toast(`${sub.number} cancelled.`);
          }}
        >
          <X size={13} strokeWidth={2.5} aria-hidden="true" /> Cancel
        </ConfirmButton>
      ) : null}
    </>
  );
}
