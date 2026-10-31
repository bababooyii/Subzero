"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";
import { cancelMySubscriptionAction, pauseMySubscriptionAction, resumeMySubscriptionAction } from "@/features/portal/actions";
import type { ActionResult } from "@/lib/action-result";
import { PayDialog } from "./PayDialog";
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
  /** Quotation accepted: the subscription becomes confirmed. */
  acceptQuotation: (sub: PortalSub) => void;
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
 * `data`; pause / resume / cancel call the portal actions and then `router.refresh()`, so every screen updates together.
 * Also hosts the single Pay dialog.
 *
 * TODO(backend): customers have no payment action and no quotation-accept action (recordPaymentAction and
 * applySubscriptionAction are staff only), so paying and accepting stay local: they flip the row for this
 * session and are not saved.
 */
export function PortalProvider({ data, children }: { data: PortalData; children: ReactNode }) {
  const router = useRouter();
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());
  const [paid, setPaid] = useState<ReadonlySet<string>>(new Set());
  const [paying, setPaying] = useState<PortalInvoice | null>(null);

  const subs = useMemo(
    () => data.subs.map((s) => (accepted.has(s.id) && s.status === "quotation" ? { ...s, status: "confirmed" as const } : s)),
    [data.subs, accepted],
  );
  const invoices = useMemo(
    () => data.invoices.map((i) => (paid.has(i.id) ? { ...i, status: "paid" as const, balance: 0 } : i)),
    [data.invoices, paid],
  );

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

  const acceptQuotation = useCallback((sub: PortalSub) => {
    setAccepted((all) => new Set(all).add(sub.id));
    toast(`Quotation ${sub.number} accepted. We will confirm the start date shortly.`);
  }, []);
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
        onPaid={(inv, method) => {
          setPaid((all) => new Set(all).add(inv.id));
          toast(`${inv.number} paid via ${method}.`);
        }}
      />
    </PortalContext.Provider>
  );
}
