"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";
import {
  acceptMyQuotationAction,
  cancelMySubscriptionAction,
  payMyInvoiceAction,
  pauseMySubscriptionAction,
  resumeMySubscriptionAction,
} from "@/features/portal/actions";
import type { ActionResult } from "@/lib/action-result";
import { PayDialog, type PayMethod } from "./PayDialog";
import type { PortalCustomer, PortalData, PortalInvoice, PortalSub } from "./types";

type Ctx = {
  customer: PortalCustomer;
  contactName: string;
  /** Server "today" (IST). */
  today: string;
  subs: PortalSub[];
  invoices: PortalInvoice[];
  /** Pause / resume / cancel through the portal actions. Resolve true when the server accepted it (the view then refreshes). */
  pauseSub: (id: string) => Promise<boolean>;
  resumeSub: (id: string) => Promise<boolean>;
  cancelSub: (id: string) => Promise<boolean>;
  /** Accepts a quotation through the portal action. Resolves true when the server accepted it (the view then refreshes). */
  acceptQuotation: (sub: PortalSub) => Promise<boolean>;
  /** Opens the checkout for an invoice. */
  pay: (invoice: PortalInvoice) => void;
};

const PortalContext = createContext<Ctx | null>(null);

export function usePortal(): Ctx {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside <PortalProvider>");
  return ctx;
}

/**
 * Client home for the customer portal. The lists, records and sidebar chip all read the server data passed in as
 * `data`; pause / resume / cancel, accepting a quotation and paying an invoice call the portal actions and then
 * `router.refresh()`, so every screen updates together. Also hosts the single Pay dialog.
 */
export function PortalProvider({ data, children }: { data: PortalData; children: ReactNode }) {
  const router = useRouter();
  const [paying, setPaying] = useState<PortalInvoice | null>(null);
  const { subs, invoices } = data;

  const run = useCallback(
    async (call: () => Promise<ActionResult<null>>) => {
      try {
        const result = await call();
        if (!result.ok) {
          toast(result.error);
          return false;
        }
        router.refresh();
        return true;
      } catch {
        toast("Something went wrong. Please try again.");
        return false;
      }
    },
    [router],
  );
  const pauseSub = useCallback((id: string) => run(() => pauseMySubscriptionAction(id)), [run]);
  const resumeSub = useCallback((id: string) => run(() => resumeMySubscriptionAction(id)), [run]);
  const cancelSub = useCallback((id: string) => run(() => cancelMySubscriptionAction(id)), [run]);

  const acceptQuotation = useCallback(
    async (sub: PortalSub) => {
      const accepted = await run(() => acceptMyQuotationAction({ subscriptionId: sub.id }));
      if (accepted) toast(`Quotation ${sub.number} accepted. We will confirm the start date shortly.`);
      return accepted;
    },
    [run],
  );
  const payInvoice = useCallback(
    (invoice: PortalInvoice, method: PayMethod) => run(() => payMyInvoiceAction({ invoiceId: invoice.id, method })),
    [run],
  );
  const pay = useCallback((invoice: PortalInvoice) => setPaying(invoice), []);

  const value = useMemo<Ctx>(
    () => ({
      customer: data.customer,
      contactName: data.customer.contactName,
      today: data.today,
      subs,
      invoices,
      pauseSub,
      resumeSub,
      cancelSub,
      acceptQuotation,
      pay,
    }),
    [data.customer, data.today, subs, invoices, pauseSub, resumeSub, cancelSub, acceptQuotation, pay],
  );

  return (
    <PortalContext.Provider value={value}>
      {children}
      <PayDialog
        invoice={paying}
        today={data.today}
        onClose={() => setPaying(null)}
        onPay={payInvoice}
        onPaid={(inv, method) => toast(`${inv.number} paid via ${method}.`)}
      />
    </PortalContext.Provider>
  );
}
