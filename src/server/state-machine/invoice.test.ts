import { describe, expect, it } from "vitest";
import {
  INVOICE_STATUSES,
  availableInvoiceActions,
  canTransitionInvoice,
  type InvoiceStatus,
} from "./invoice";
import { InvalidTransitionError } from "./errors";

const unpaid = { total: 10000, amountPaid: 0 };
const partial = { total: 10000, amountPaid: 4000 };
const full = { total: 10000, amountPaid: 10000 };
const over = { total: 10000, amountPaid: 12000 };

describe("canTransitionInvoice", () => {
  it("allows draft -> confirmed and draft -> cancelled", () => {
    expect(canTransitionInvoice("draft", "confirmed", unpaid)).toEqual({ ok: true });
    expect(canTransitionInvoice("draft", "cancelled", unpaid)).toEqual({ ok: true });
  });

  it("allows confirmed -> cancelled only when nothing is paid", () => {
    expect(canTransitionInvoice("confirmed", "cancelled", unpaid)).toEqual({ ok: true });
    expect(canTransitionInvoice("confirmed", "cancelled", partial)).toEqual({
      ok: false,
      reason: "Cannot cancel an invoice with payments",
    });
    expect(canTransitionInvoice("confirmed", "cancelled", full).ok).toBe(false);
  });

  it("allows confirmed -> paid only when amountPaid >= total", () => {
    expect(canTransitionInvoice("confirmed", "paid", full)).toEqual({ ok: true });
    expect(canTransitionInvoice("confirmed", "paid", over)).toEqual({ ok: true });
    expect(canTransitionInvoice("confirmed", "paid", partial)).toEqual({
      ok: false,
      reason: "Invoice is not fully paid",
    });
    expect(canTransitionInvoice("confirmed", "paid", unpaid).ok).toBe(false);
  });

  it("forbids every other pair", () => {
    const allowed = new Set(["draft>confirmed", "draft>cancelled", "confirmed>cancelled", "confirmed>paid"]);
    for (const from of INVOICE_STATUSES) {
      for (const to of INVOICE_STATUSES) {
        if (allowed.has(`${from}>${to}`)) continue;
        expect(canTransitionInvoice(from, to, full).ok, `${from} -> ${to}`).toBe(false);
      }
    }
  });

  it("paid and cancelled are terminal", () => {
    for (const from of ["paid", "cancelled"] as InvoiceStatus[]) {
      for (const to of INVOICE_STATUSES) {
        expect(canTransitionInvoice(from, to, unpaid).ok).toBe(false);
      }
    }
  });

  it("draft cannot jump straight to paid", () => {
    expect(canTransitionInvoice("draft", "paid", full).ok).toBe(false);
  });
});

describe("availableInvoiceActions", () => {
  it("draft offers confirm and cancel", () => {
    expect(availableInvoiceActions("draft", unpaid)).toEqual([
      { action: "confirm", to: "confirmed", label: "Confirm" },
      { action: "cancel", to: "cancelled", label: "Cancel" },
    ]);
  });

  it("confirmed with no payment offers cancel only", () => {
    expect(availableInvoiceActions("confirmed", unpaid)).toEqual([
      { action: "cancel", to: "cancelled", label: "Cancel" },
    ]);
  });

  it("confirmed with partial payment offers nothing", () => {
    expect(availableInvoiceActions("confirmed", partial)).toEqual([]);
  });

  it("confirmed and fully paid offers mark_paid only", () => {
    expect(availableInvoiceActions("confirmed", full)).toEqual([
      { action: "mark_paid", to: "paid", label: "Mark paid" },
    ]);
  });

  it("terminal statuses offer nothing", () => {
    expect(availableInvoiceActions("paid", full)).toEqual([]);
    expect(availableInvoiceActions("cancelled", unpaid)).toEqual([]);
  });
});

describe("InvalidTransitionError", () => {
  it("carries entity, from, to and reason", () => {
    const err = new InvalidTransitionError("invoice", "paid", "draft", "nope");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("InvalidTransitionError");
    expect(err).toMatchObject({ entity: "invoice", from: "paid", to: "draft", reason: "nope" });
    expect(err.message).toContain("paid -> draft");
  });
});
