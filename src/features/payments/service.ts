import { eq, sql } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { invoices, payments } from "@/db/schema";
import type { Actor } from "@/lib/auth/session";
import { logActivity } from "@/server/activity-log";
import { transitionInvoice } from "@/server/state-machine";
import { paymentInput, type PaymentInput } from "./schemas";

type Executor = DB | Tx;

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

export async function recordPayment(tx: Executor, input: PaymentInput, actor: Actor) {
  const v = paymentInput.parse(input);

  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, v.invoiceId)).for("update");
  if (!inv) throw new PaymentError("Invoice not found");
  if (inv.status !== "confirmed") {
    throw new PaymentError(`Payments can only be recorded on confirmed invoices (this one is ${inv.status})`);
  }
  const balance = inv.total - inv.amountPaid;
  if (v.amount > balance) {
    throw new PaymentError(`Amount exceeds the outstanding balance of ${balance} paise`);
  }

  const [payment] = await tx
    .insert(payments)
    .values({
      invoiceId: v.invoiceId,
      method: v.method,
      amount: v.amount,
      paidOn: v.paidOn,
      note: v.note ?? null,
      recordedBy: actor.id,
    })
    .returning();

  const newPaid = inv.amountPaid + v.amount;
  await tx
    .update(invoices)
    .set({ amountPaid: newPaid, updatedAt: new Date() })
    .where(eq(invoices.id, inv.id));

  await logActivity(tx, {
    entityType: "payment",
    entityId: payment.id,
    action: "recorded",
    actorId: actor.id,
    meta: { invoiceId: inv.id, amount: v.amount, method: v.method },
  });
  await logActivity(tx, {
    entityType: "invoice",
    entityId: inv.id,
    action: "payment_recorded",
    actorId: actor.id,
    meta: { paymentId: payment.id, amount: v.amount },
  });

  if (newPaid >= inv.total) {
    await transitionInvoice(tx, { id: inv.id, to: "paid", actor });
  }
  return payment;
}

/** Admin only; supports the Undo toast. Paid invoices cannot be reopened, so their payments stay. */
export async function deletePayment(tx: Executor, id: string, actor: Actor) {
  if (actor.role !== "admin") throw new PaymentError("Forbidden");

  const [payment] = await tx.select().from(payments).where(eq(payments.id, id));
  if (!payment) throw new PaymentError("Payment not found");
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, payment.invoiceId)).for("update");
  if (inv.status === "paid") {
    throw new PaymentError("Payments on a paid invoice cannot be deleted");
  }

  await tx.delete(payments).where(eq(payments.id, id));
  await tx
    .update(invoices)
    .set({ amountPaid: sql`${invoices.amountPaid} - ${payment.amount}`, updatedAt: new Date() })
    .where(eq(invoices.id, inv.id));

  await logActivity(tx, {
    entityType: "payment",
    entityId: id,
    action: "deleted",
    actorId: actor.id,
    meta: { invoiceId: inv.id, amount: payment.amount },
  });
  await logActivity(tx, {
    entityType: "invoice",
    entityId: inv.id,
    action: "payment_deleted",
    actorId: actor.id,
    meta: { paymentId: id, amount: payment.amount },
  });
  return payment;
}
