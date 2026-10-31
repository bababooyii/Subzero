import { listActivity, type ActivityEntityType } from "@/server/activity-log";
import { transitionInvoice } from "@/server/state-machine";
import type { InvoiceDeps } from "./service";

export const invoiceDeps: InvoiceDeps = {
  transitionInvoice: (tx, input) => transitionInvoice(tx, input),
  listActivity: (db, type, id) => listActivity(db, type as ActivityEntityType, id),
};
