import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { customers, invoices } from "@/db/schema";
import { createPaymentTerm, createPlan, createProduct, createTax, createTemplate } from "@/features/catalog/service";
import { dashboardKpis } from "@/features/dashboard/queries";
import { createCustomer } from "@/features/customers/service";
import { createDiscount } from "@/features/discounts/service";
import { invoiceDeps } from "@/features/invoices/deps";
import { confirmInvoice, sendInvoice } from "@/features/invoices/service";
import { recordPayment } from "@/features/payments/service";
import { myInvoices } from "@/features/portal/queries";
import { applyAction, createFromTemplate } from "@/features/subscriptions/service";
import { billingDeps } from "@/features/billing/deps";
import { todayIST } from "@/lib/dates";
import { runBilling } from "@/server/billing";
import { makeUser } from "@/server/state-machine/fixtures";
import { testDb, truncateAll } from "@/test/db";

vi.mock("@/server/mail", () => ({ sendMail: vi.fn(async () => ({})) }));

beforeEach(truncateAll);

describe("demo story, end to end through the real services", () => {
  it("quotation to paid invoice, with discount, KPIs and portal scoping", async () => {
    const today = todayIST();
    const admin = await makeUser("admin", "Admin");
    const staff = await makeUser("staff", "Staff");

    // Admin sets up the catalog.
    const tax = await createTax(testDb, { name: "GST 18%", rateBps: 1800 }, admin);
    const product = await createProduct(
      testDb,
      {
        name: "Odoo Subscription",
        type: "service",
        salesPrice: 100000,
        costPrice: 40000,
        taxIds: [tax.id],
        variants: [{ attribute: "Brand", value: "Odoo", extraPrice: 56000 }],
      },
      admin,
    );
    const { getProduct } = await import("@/features/catalog/queries");
    const detail = await getProduct(testDb, product.id);
    const variantId = detail!.variants[0].id;
    const plan = await createPlan(
      testDb,
      {
        name: "Monthly",
        price: 0,
        interval: "monthly",
        intervalCount: 1,
        minQty: 1,
        availableFrom: "2020-01-01",
        availableTo: null,
        autoClose: false,
        closable: true,
        pausable: true,
        renewable: true,
      },
      admin,
    );
    const term = await createPaymentTerm(testDb, { name: "Net 15", dueDays: 15 }, admin);
    const template = await createTemplate(
      testDb,
      {
        name: "Odoo monthly",
        validityDays: 30,
        planId: plan.id,
        paymentTermId: term.id,
        lines: [{ productId: product.id, variantId, quantity: 1 }],
      },
      admin,
    );
    await createDiscount(
      testDb,
      { name: "Launch 10%", kind: "percent", value: 1000, scope: "subscription" },
      admin,
    );

    // Staff creates the customer and walks the subscription to active.
    const customer = await createCustomer(
      testDb,
      { name: "Acme Corp", email: "buyer@acme.test" },
      staff,
    );
    const sub = await createFromTemplate(
      testDb,
      { templateId: template.id, customerId: customer.id, startDate: today },
      staff,
    );
    expect(sub.status).toBe("draft");
    for (const action of ["send_quotation", "confirm", "activate"] as const) {
      await applyAction(testDb, { id: sub.id, action }, staff);
    }

    // Billing: 156000 - 10% (15600) = 140400; GST 18% = 25272; total 165672.
    const run = await runBilling(testDb, { on: today, actor: staff }, billingDeps);
    expect(run.created).toHaveLength(1);
    const again = await runBilling(testDb, { on: today, actor: staff }, billingDeps);
    expect(again.created).toHaveLength(0);

    const all = await testDb.select().from(invoices);
    expect(all).toHaveLength(1);
    const inv = all[0];
    expect(inv).toMatchObject({
      status: "draft",
      subtotal: 156000,
      discountTotal: 15600,
      taxTotal: 25272,
      total: 165672,
    });

    // Confirm, send, partial then full payment.
    await testDb.transaction((tx) => confirmInvoice(tx, inv.id, staff, invoiceDeps));
    await testDb.transaction((tx) => sendInvoice(tx, inv.id, staff, invoiceDeps));
    await testDb.transaction((tx) =>
      recordPayment(tx, { invoiceId: inv.id, method: "upi", amount: 65672, paidOn: today }, staff),
    );
    const [partial] = await testDb.select().from(invoices).where(eq(invoices.id, inv.id));
    expect(partial).toMatchObject({ status: "confirmed", amountPaid: 65672 });
    await testDb.transaction((tx) =>
      recordPayment(tx, { invoiceId: inv.id, method: "bank_transfer", amount: 100000, paidOn: today }, staff),
    );
    const [paid] = await testDb.select().from(invoices).where(eq(invoices.id, inv.id));
    expect(paid).toMatchObject({ status: "paid", amountPaid: 165672 });

    // Dashboard.
    const kpis = await dashboardKpis(testDb, { from: today, to: today, today });
    expect(kpis.activeSubscriptions).toBe(1);
    expect(kpis.collected).toBe(165672);
    expect(kpis.outstanding).toBe(0);

    // Portal: the linked customer sees only their own invoice; a stranger sees none.
    const portalUser = await makeUser("customer", "Acme Buyer");
    await testDb.update(customers).set({ userId: portalUser.id }).where(eq(customers.id, customer.id));
    const mine = await myInvoices(testDb, portalUser);
    expect(mine.rows.map((r) => r.id)).toEqual([inv.id]);
    const stranger = await makeUser("customer", "Stranger");
    expect((await myInvoices(testDb, stranger)).total).toBe(0);
  });
});
