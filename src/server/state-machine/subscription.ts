export const SUBSCRIPTION_STATUSES = [
  "draft",
  "quotation",
  "confirmed",
  "active",
  "paused",
  "closed",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type SubscriptionAction =
  | "send_quotation"
  | "confirm"
  | "activate"
  | "pause"
  | "resume"
  | "close"
  | "cancel"
  | "revise";

export type SubscriptionPlanFlags = {
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  autoClose: boolean;
};

export type SubscriptionCtx = {
  plan: SubscriptionPlanFlags;
  /** Expiry / auto-close: bypasses the plan.closable guard. */
  system?: boolean;
};

export type TransitionResult = { ok: true } | { ok: false; reason: string };

type Rule = {
  from: SubscriptionStatus;
  to: SubscriptionStatus;
  action: SubscriptionAction;
  label: string;
  guard?: (ctx: SubscriptionCtx) => string | null;
};

const requireClosable = (ctx: SubscriptionCtx) =>
  ctx.system || ctx.plan.closable ? null : "Plan does not allow closing";

const RULES: readonly Rule[] = [
  { from: "draft", to: "quotation", action: "send_quotation", label: "Send quotation" },
  { from: "draft", to: "closed", action: "cancel", label: "Cancel" },
  { from: "quotation", to: "confirmed", action: "confirm", label: "Confirm" },
  { from: "quotation", to: "draft", action: "revise", label: "Revise" },
  { from: "quotation", to: "closed", action: "cancel", label: "Cancel" },
  { from: "confirmed", to: "active", action: "activate", label: "Activate" },
  {
    from: "active",
    to: "paused",
    action: "pause",
    label: "Pause",
    guard: (ctx) => (ctx.plan.pausable ? null : "Plan does not allow pausing"),
  },
  { from: "paused", to: "active", action: "resume", label: "Resume" },
  { from: "active", to: "closed", action: "close", label: "Close", guard: requireClosable },
  { from: "paused", to: "closed", action: "close", label: "Close", guard: requireClosable },
];

export function canTransitionSubscription(
  from: SubscriptionStatus,
  to: SubscriptionStatus,
  ctx: SubscriptionCtx,
): TransitionResult {
  const rule = RULES.find((r) => r.from === from && r.to === to);
  if (!rule) return { ok: false, reason: `Cannot move a subscription from ${from} to ${to}` };
  const blocked = rule.guard?.(ctx) ?? null;
  return blocked ? { ok: false, reason: blocked } : { ok: true };
}

export function availableSubscriptionActions(
  status: SubscriptionStatus,
  ctx: SubscriptionCtx,
): { action: SubscriptionAction; to: SubscriptionStatus; label: string }[] {
  return RULES.filter((r) => r.from === status && !r.guard?.(ctx)).map((r) => ({
    action: r.action,
    to: r.to,
    label: r.label,
  }));
}
