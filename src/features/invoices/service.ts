import { eq, sql } from "drizzle-orm";
import type { DB, Tx } from "@/db/client";
import { activityLog, customers, invoices } from "@/db/schema";
import { assertRole, ServiceError } from "@/features/catalog/errors";
import type { Actor } from "@/lib/auth/session";
import { sendMail } from "@/server/mail";
import {
  invoiceIdInput,
  invoiceIdsInput,
  type InvoiceAction,
  type InvoiceStatus,
} from "./schemas";

type Db = DB | Tx;

/** Injected from the state-machine / activity modules (landed on another branch). */
export type InvoiceDeps = {
  transitionInvoice(
    tx: Tx,
    input: { id: string; to: InvoiceStatus; actor: Actor },
  ): Promise<unknown>;
  listActivity(db: Db, type: string, id: string): Promise<unknown[]>;
};

export type BulkResult = {
  done: string[];
  failed: { id: string; error: string }[];
};

/** Same rules as the state machine: draft -> confirm/cancel; confirmed -> cancel only while unpaid. */
export function availableActions(
  inv: Pick<typeof invoices.$inferSelect, "status" | "total" | "amountPaid">,
): InvoiceAction[] {
  if (inv.status === "draft") return ["confirm", "cancel"];
  if (inv.status === "confirmed" && inv.amountPaid === 0) return ["cancel"];
  return [];
}

async function transition(
  tx: Tx,
  deps: InvoiceDeps,
  id: string,
  to: InvoiceStatus,
  actor: Actor,
) {
  await deps.transitionInvoice(tx, { id, to, actor });
}

async function load(db: Db, id: string) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!inv) throw new ServiceError("Invoice not found");
  return inv;
}

export async function confirmInvoice(
  tx: Tx,
  rawId: string,
  actor: Actor,
  deps: InvoiceDeps,
) {
  assertRole(actor, "admin", "staff");
  const id = invoiceIdInput.parse(rawId);
  await load(tx, id);
  await transition(tx, deps, id, "confirmed", actor);
  return { id };
}

export async function cancelInvoice(
  tx: Tx,
  rawId: string,
  actor: Actor,
  deps: InvoiceDeps,
) {
  assertRole(actor, "admin", "staff");
  const id = invoiceIdInput.parse(rawId);
  const inv = await load(tx, id);
  if (!availableActions(inv).includes("cancel")) {
    throw new ServiceError("This invoice cannot be cancelled");
  }
  await transition(tx, deps, id, "cancelled", actor);
  return { id };
}

function invoiceLink(id: string) {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/invoices/${id}`;
}

/** Confirms a draft, emails the customer, stamps `sent_at` and logs a "sent" activity. */
export async function sendInvoice(
  tx: Tx,
  rawId: string,
  actor: Actor,
  deps: InvoiceDeps,
) {
  assertRole(actor, "admin", "staff");
  const id = invoiceIdInput.parse(rawId);
  const inv = await load(tx, id);
  if (inv.status === "cancelled")
    throw new ServiceError("A cancelled invoice cannot be sent");
  if (inv.status === "draft")
    await transition(tx, deps, id, "confirmed", actor);

  const [customer] = await tx
    .select()
    .from(customers)
    .where(eq(customers.id, inv.customerId));
  if (!customer) throw new ServiceError("Customer not found");

  const link = invoiceLink(id);
  await sendMail({
    to: customer.email,
    subject: `Invoice ${inv.number}`,
    text: `Hi ${customer.name},\n\nInvoice ${inv.number} is ready. View it here: ${link}\n`,
    html: `<p>Hi ${customer.name},</p><p>Invoice ${inv.number} is ready. <a href="${link}">View invoice</a></p>`,
  });

  await tx
    .update(invoices)
    .set({ sentAt: sql`now()` })
    .where(eq(invoices.id, id));
  await tx.insert(activityLog).values({
    entityType: "invoice",
    entityId: id,
    action: "sent",
    actorId: actor.id,
    meta: { to: customer.email },
  });
  return { id };
}

async function bulk(
  tx: Tx,
  rawIds: string[],
  actor: Actor,
  deps: InvoiceDeps,
  fn: (tx: Tx, id: string, actor: Actor, deps: InvoiceDeps) => Promise<unknown>,
): Promise<BulkResult> {
  assertRole(actor, "admin", "staff");
  const ids = invoiceIdsInput.parse(rawIds);
  const result: BulkResult = { done: [], failed: [] };
  for (const id of ids) {
    // Savepoint so one failing invoice does not abort the whole transaction.
    try {
      await tx.transaction((sp) => fn(sp, id, actor, deps));
      result.done.push(id);
    } catch (err) {
      if (!(err instanceof ServiceError) && !(err instanceof Error)) throw err;
      result.failed.push({ id, error: err.message });
    }
  }
  return result;
}

export function bulkConfirm(
  tx: Tx,
  ids: string[],
  actor: Actor,
  deps: InvoiceDeps,
) {
  return bulk(tx, ids, actor, deps, confirmInvoice);
}

export function bulkSend(
  tx: Tx,
  ids: string[],
  actor: Actor,
  deps: InvoiceDeps,
) {
  return bulk(tx, ids, actor, deps, sendInvoice);
}
