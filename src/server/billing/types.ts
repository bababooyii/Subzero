import type { DB, Tx } from "@/db/client";
import type { DiscountRule } from "@/server/pricing";

export type { DB, Tx };

/** Lane C functions, injected so billing doesn't import other lanes' branches. */
export type BillingDeps = {
  listApplicableDiscounts(
    db: DB | Tx,
    input: { productIds: string[]; on: string },
  ): Promise<DiscountRule[]>;
  /** Returns the ids of discounts that failed their usage limit. */
  redeemDiscounts(
    tx: Tx,
    invoiceId: string,
    applied: { discountId: string; amount: number }[],
  ): Promise<string[]>;
  closeSubscription(tx: Tx, subscriptionId: string): Promise<void>;
};

export type BillingActor = { id: string; role: "admin" | "staff" | "customer" };
