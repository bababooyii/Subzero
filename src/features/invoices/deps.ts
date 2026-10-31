import type { InvoiceDeps } from "./service";

/**
 * TODO(merge): wire to `transitionInvoice` from "@/server/state-machine" and
 * `listActivity` from the activity module once lane C's branch lands.
 * Until then actions fail loudly rather than write statuses ad hoc.
 */
export const invoiceDeps: InvoiceDeps = {
  async transitionInvoice() {
    throw new Error(
      "transitionInvoice is not wired yet (state machine lives on another branch)",
    );
  },
  async listActivity() {
    return [];
  },
};
