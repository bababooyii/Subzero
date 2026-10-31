import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerRecord } from "@/components/customers/CustomerRecord";
import type { CustomerDetail } from "@/components/customers/rows";
import { activityEvents, isUuid, toInvoiceRow } from "@/components/subscriptions/rows";
import { db } from "@/db/client";
import { getCustomer } from "@/features/customers/queries";
import { listInvoices } from "@/features/invoices/queries";
import { listPayments } from "@/features/payments/queries";
import { listSubscriptions } from "@/features/subscriptions/queries";
import { todayIST } from "@/lib/dates";
import { listActivity } from "@/server/activity-log";

export default function Page(props: PageProps<"/customers/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-48 w-full max-w-[1240px] animate-pulse px-8 py-8" />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const customer = await getCustomer(db, id);
  if (!customer) notFound();

  const today = todayIST();
  const [subs, invoices, overdueInvoices, payments] = await Promise.all([
    listSubscriptions(db, { customerId: id, today, pageSize: 100 }),
    listInvoices(db, { customerId: id, today, pageSize: 100 }),
    listInvoices(db, { customerId: id, today, view: "overdue", pageSize: 200 }),
    listPayments(db, { customerId: id, pageSize: 100 }),
  ]);

  // Customers have no activity of their own: the timeline is the newest subscriptions' history.
  const recent = subs.rows.slice(0, 5);
  const histories = await Promise.all(recent.map((s) => listActivity(db, "subscription", s.id)));
  const events = histories
    .flatMap((items, i) => activityEvents(recent[i].number, items, `act-${recent[i].id}`))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 8);

  const detail: CustomerDetail = {
    id: customer.id,
    name: customer.name,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    gstin: customer.gstin,
    createdAt: customer.createdAt,
    activeSubscriptions: customer.activeSubscriptions,
    outstanding: customer.outstanding,
    overdue: overdueInvoices.rows.reduce((n, i) => n + i.balance, 0),
    counts: { subscriptions: subs.total, invoices: invoices.total, payments: payments.total },
    subscriptions: subs.rows,
    invoices: invoices.rows.map(toInvoiceRow),
    payments: payments.rows.map((p) => ({
      id: p.id,
      date: p.paidOn,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoiceNumber,
      method: p.method,
      amount: p.amount,
      note: p.note ?? "",
    })),
    events,
  };
  return <CustomerRecord detail={detail} />;
}
