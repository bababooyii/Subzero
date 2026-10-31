"use server";

import { db } from "@/db/client";
import { runAction } from "@/features/catalog/action-helpers";
import { requireActor } from "@/lib/auth/session";
import { fail, ok } from "@/lib/action-result";
import { invoiceDeps } from "./deps";
import { getInvoice, listInvoices, type ListInvoicesParams } from "./queries";
import {
  bulkConfirm,
  bulkSend,
  cancelInvoice,
  confirmInvoice,
  sendInvoice,
} from "./service";

const paths = (id?: string) => [
  "/invoices",
  ...(id ? [`/invoices/${id}`] : []),
];
const today = () => new Date().toISOString().slice(0, 10);

export async function confirmInvoiceAction(id: string) {
  return runAction(["admin", "staff"], paths(id), (tx, actor) =>
    confirmInvoice(tx, id, actor, invoiceDeps),
  );
}

export async function cancelInvoiceAction(id: string) {
  return runAction(["admin", "staff"], paths(id), (tx, actor) =>
    cancelInvoice(tx, id, actor, invoiceDeps),
  );
}

export async function sendInvoiceAction(id: string) {
  return runAction(["admin", "staff"], paths(id), (tx, actor) =>
    sendInvoice(tx, id, actor, invoiceDeps),
  );
}

export async function bulkConfirmInvoicesAction(ids: string[]) {
  return runAction(["admin", "staff"], paths(), (tx, actor) =>
    bulkConfirm(tx, ids, actor, invoiceDeps),
  );
}

export async function bulkSendInvoicesAction(ids: string[]) {
  return runAction(["admin", "staff"], paths(), (tx, actor) =>
    bulkSend(tx, ids, actor, invoiceDeps),
  );
}

export async function listInvoicesAction(
  params: Omit<ListInvoicesParams, "today">,
) {
  try {
    await requireActor("admin", "staff");
    return ok(await listInvoices(db, { ...params, today: today() }));
  } catch {
    return fail("Forbidden");
  }
}

export async function getInvoiceAction(id: string) {
  try {
    await requireActor("admin", "staff");
    return ok(await getInvoice(db, id, { today: today(), deps: invoiceDeps }));
  } catch {
    return fail("Forbidden");
  }
}
