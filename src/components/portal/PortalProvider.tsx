"use client";

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "@/components/ui/toast";
import type { PortalInvoice, PortalSub } from "@/lib/mock/selectors-portal";
import type { Customer, SubscriptionStatus } from "@/lib/mock/types";
import { PayDialog } from "./PayDialog";

type Ctx = {
  customer: Customer;
  contactName: string;
  subs: PortalSub[];
  invoices: PortalInvoice[];
  setSubStatus: (id: string, status: SubscriptionStatus) => void;
  /** Quotation accepted: the subscription becomes confirmed. */
  acceptQuotation: (sub: PortalSub) => void;
  /** Opens the (mock) checkout for an invoice. */
  pay: (invoice: PortalInvoice) => void;
};

const PortalContext = createContext<Ctx | null>(null);

export function usePortal(): Ctx {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside <PortalProvider>");
  return ctx;
}

type Props = { customer: Customer; contactName: string; subscriptions: PortalSub[]; invoices: PortalInvoice[]; children: ReactNode };

/**
 * Client state for the customer portal (mock data, nothing persists). One source of truth for the sidebar chip,
 * the overview, the lists and the records, so paying or pausing shows up everywhere without a reload.
 * Also hosts the single Pay dialog.
 */
export function PortalProvider({ customer, contactName, subscriptions, invoices: initialInvoices, children }: Props) {
  const [subs, setSubs] = useState(subscriptions);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [paying, setPaying] = useState<PortalInvoice | null>(null);

  const setSubStatus = useCallback(
    (id: string, status: SubscriptionStatus) => setSubs((all) => all.map((s) => (s.id === id ? { ...s, status } : s))),
    [],
  );
  const acceptQuotation = useCallback(
    (sub: PortalSub) => {
      setSubStatus(sub.id, "confirmed");
      toast(`Quotation ${sub.number} accepted. We will confirm the start date shortly.`);
    },
    [setSubStatus],
  );
  const pay = useCallback((invoice: PortalInvoice) => setPaying(invoice), []);

  const value = useMemo<Ctx>(
    () => ({ customer, contactName, subs, invoices, setSubStatus, acceptQuotation, pay }),
    [customer, contactName, subs, invoices, setSubStatus, acceptQuotation, pay],
  );

  return (
    <PortalContext.Provider value={value}>
      {children}
      <PayDialog
        invoice={paying}
        onClose={() => setPaying(null)}
        onPaid={(inv, method) => {
          setInvoices((all) => all.map((i) => (i.id === inv.id ? { ...i, status: "paid", balance: 0 } : i)));
          toast(`${inv.number} paid via ${method}.`);
        }}
      />
    </PortalContext.Provider>
  );
}
