// Test-only fixtures for lane C DB tests (imported by *.db.test.ts files).
import { testDb } from "@/test/db";
import {
  customers,
  invoices,
  paymentTerms,
  plans,
  productTaxes,
  productVariants,
  products,
  subscriptions,
  taxes,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/session";

let seq = 0;
const n = () => ++seq;

export async function makeUser(role: "admin" | "staff" | "customer" = "staff", name = "Test User") {
  const id = `u${n()}`;
  await testDb.insert(user).values({ id, name, email: `${id}@test.local`, role });
  return { id, role } as Actor;
}

export async function makeCustomer(overrides: Partial<typeof customers.$inferInsert> = {}) {
  const [c] = await testDb
    .insert(customers)
    .values({ name: `Customer ${n()}`, email: `c${n()}@test.local`, ...overrides })
    .returning();
  return c;
}

export async function makePlan(overrides: Partial<typeof plans.$inferInsert> = {}) {
  const [p] = await testDb
    .insert(plans)
    .values({ name: `Plan ${n()}`, price: 100000, ...overrides })
    .returning();
  return p;
}

export async function makeTerm() {
  const [t] = await testDb.insert(paymentTerms).values({ name: "Net 15", dueDays: 15 }).returning();
  return t;
}

export async function makeProduct(opts: { salesPrice?: number; taxRatesBps?: number[] } = {}) {
  const [p] = await testDb
    .insert(products)
    .values({ name: `Product ${n()}`, salesPrice: opts.salesPrice ?? 50000 })
    .returning();
  for (const rate of opts.taxRatesBps ?? []) {
    const [t] = await testDb.insert(taxes).values({ name: `GST ${rate}`, rateBps: rate }).returning();
    await testDb.insert(productTaxes).values({ productId: p.id, taxId: t.id });
  }
  return p;
}

export async function makeVariant(productId: string, extraPrice: number) {
  const [v] = await testDb
    .insert(productVariants)
    .values({ productId, attribute: "Tier", value: `V${n()}`, extraPrice })
    .returning();
  return v;
}

/** Raw insert (bypasses the service) so tests can start from any state via `overrides`. */
export async function makeSubscription(
  planId: string,
  overrides: Partial<typeof subscriptions.$inferInsert> = {},
) {
  const customer = await makeCustomer();
  const [s] = await testDb
    .insert(subscriptions)
    .values({
      number: `SUB-T${n()}`,
      customerId: customer.id,
      planId,
      startDate: "2026-01-01",
      ...overrides,
    })
    .returning();
  return s;
}

export async function makeInvoice(
  subscriptionId: string,
  customerId: string,
  overrides: Partial<typeof invoices.$inferInsert> = {},
) {
  const [i] = await testDb
    .insert(invoices)
    .values({
      number: `INV-T${n()}`,
      subscriptionId,
      customerId,
      customerSnapshot: {},
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      issuedOn: "2026-01-01",
      dueDate: "2026-01-15",
      total: 10000,
      ...overrides,
    })
    .returning();
  return i;
}
