/** Saved-view keys for the portal lists. Kept out of the client components so server pages can read them. */
export type SubscriptionView = "all" | "active" | "paused" | "closed";
export const SUBSCRIPTION_VIEWS: SubscriptionView[] = ["all", "active", "paused", "closed"];

export type InvoiceView = "all" | "unpaid" | "overdue" | "paid";
export const INVOICE_VIEWS: InvoiceView[] = ["all", "unpaid", "overdue", "paid"];
