import { describe, expect, it } from "vitest";
import {
  SUBSCRIPTION_STATUSES,
  availableSubscriptionActions,
  canTransitionSubscription,
  type SubscriptionCtx,
  type SubscriptionStatus,
} from "./subscription";

const open: SubscriptionCtx = {
  plan: { closable: true, pausable: true, renewable: true, autoClose: false },
};
const locked: SubscriptionCtx = {
  plan: { closable: false, pausable: false, renewable: false, autoClose: false },
};

const allowed: [SubscriptionStatus, SubscriptionStatus][] = [
  ["draft", "quotation"],
  ["draft", "closed"],
  ["quotation", "confirmed"],
  ["quotation", "draft"],
  ["quotation", "closed"],
  ["confirmed", "active"],
  ["active", "paused"],
  ["paused", "active"],
  ["active", "closed"],
  ["paused", "closed"],
];

describe("canTransitionSubscription", () => {
  it.each(allowed)("allows %s -> %s", (from, to) => {
    expect(canTransitionSubscription(from, to, open)).toEqual({ ok: true });
  });

  it("forbids every pair not in the allowed list", () => {
    for (const from of SUBSCRIPTION_STATUSES) {
      for (const to of SUBSCRIPTION_STATUSES) {
        if (allowed.some(([f, t]) => f === from && t === to)) continue;
        const res = canTransitionSubscription(from, to, open);
        expect(res.ok, `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("closed is terminal", () => {
    for (const to of SUBSCRIPTION_STATUSES) {
      expect(canTransitionSubscription("closed", to, open).ok).toBe(false);
    }
  });

  it("pause requires plan.pausable", () => {
    const res = canTransitionSubscription("active", "paused", locked);
    expect(res).toEqual({ ok: false, reason: "Plan does not allow pausing" });
  });

  it("resume does not require pausable", () => {
    expect(canTransitionSubscription("paused", "active", locked)).toEqual({ ok: true });
  });

  it.each(["active", "paused"] as const)("close from %s requires plan.closable", (from) => {
    expect(canTransitionSubscription(from, "closed", locked)).toEqual({
      ok: false,
      reason: "Plan does not allow closing",
    });
  });

  it.each(["active", "paused"] as const)("system bypasses closable from %s", (from) => {
    expect(canTransitionSubscription(from, "closed", { ...locked, system: true })).toEqual({
      ok: true,
    });
  });

  it("system does not bypass the pausable guard or invalid edges", () => {
    expect(canTransitionSubscription("active", "paused", { ...locked, system: true }).ok).toBe(
      false,
    );
    expect(canTransitionSubscription("closed", "active", { ...open, system: true }).ok).toBe(false);
  });

  it("cancel from draft/quotation ignores plan.closable", () => {
    expect(canTransitionSubscription("draft", "closed", locked).ok).toBe(true);
    expect(canTransitionSubscription("quotation", "closed", locked).ok).toBe(true);
  });

  it("returns a non-empty reason for forbidden moves", () => {
    const res = canTransitionSubscription("draft", "active", open);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/draft.*active/);
  });
});

describe("availableSubscriptionActions", () => {
  it("lists actions per status with labels", () => {
    expect(availableSubscriptionActions("draft", open)).toEqual([
      { action: "send_quotation", to: "quotation", label: "Send quotation" },
      { action: "cancel", to: "closed", label: "Cancel" },
    ]);
    expect(availableSubscriptionActions("quotation", open)).toEqual([
      { action: "confirm", to: "confirmed", label: "Confirm" },
      { action: "revise", to: "draft", label: "Revise" },
      { action: "cancel", to: "closed", label: "Cancel" },
    ]);
    expect(availableSubscriptionActions("confirmed", open)).toEqual([
      { action: "activate", to: "active", label: "Activate" },
    ]);
    expect(availableSubscriptionActions("active", open)).toEqual([
      { action: "pause", to: "paused", label: "Pause" },
      { action: "close", to: "closed", label: "Close" },
    ]);
    expect(availableSubscriptionActions("paused", open)).toEqual([
      { action: "resume", to: "active", label: "Resume" },
      { action: "close", to: "closed", label: "Close" },
    ]);
    expect(availableSubscriptionActions("closed", open)).toEqual([]);
  });

  it("hides guarded actions when the plan forbids them", () => {
    expect(availableSubscriptionActions("active", locked)).toEqual([]);
    expect(availableSubscriptionActions("paused", locked)).toEqual([
      { action: "resume", to: "active", label: "Resume" },
    ]);
  });

  it("system context exposes close even when not closable", () => {
    expect(availableSubscriptionActions("active", { ...locked, system: true })).toEqual([
      { action: "close", to: "closed", label: "Close" },
    ]);
  });

  it("every offered action is accepted by canTransitionSubscription", () => {
    for (const ctx of [open, locked, { ...locked, system: true }]) {
      for (const s of SUBSCRIPTION_STATUSES) {
        for (const a of availableSubscriptionActions(s, ctx)) {
          expect(canTransitionSubscription(s, a.to, ctx).ok).toBe(true);
        }
      }
    }
  });
});
