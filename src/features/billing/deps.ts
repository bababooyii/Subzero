import { listApplicableDiscounts } from "@/features/discounts/queries";
import { redeemDiscounts } from "@/features/discounts/service";
import type { BillingDeps } from "@/server/billing";
import { transitionSubscription } from "@/server/state-machine";

export const billingDeps: BillingDeps = {
  listApplicableDiscounts,
  redeemDiscounts,
  closeSubscription: async (tx, id) => {
    await transitionSubscription(tx, { id, to: "closed", actor: null, system: true });
  },
};
