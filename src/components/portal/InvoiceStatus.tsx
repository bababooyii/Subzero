import { StatusDot } from "@/components/ui/StatusDot";
import type { PortalInvoice } from "./types";

/** Status dot for a customer's invoice. A confirmed invoice with money owed reads "Open" to the customer. */
export function InvoiceStatus({ status }: { status: PortalInvoice["status"] }) {
  return <StatusDot status={status} label={status === "confirmed" ? "Open" : undefined} />;
}
