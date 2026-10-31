import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import {
  activityLog,
  customers,
  discountProducts,
  discounts,
  invoiceLines,
  invoices,
  paymentTerms,
  payments,
  plans,
  productTaxes,
  productVariants,
  products,
  quotationTemplateLines,
  quotationTemplates,
  subscriptionLines,
  subscriptions,
  taxes,
  user,
} from "../schema";
import { addDays, addInterval } from "../../lib/dates";
import { price } from "../../server/pricing";
import { generateDataset, type Dataset, type SubscriptionRow } from "./generate";
import { createRng, daysBetween } from "./rng";

const BATCH = 1000;
const SEED = Number(process.env.SEED ?? 42);
const TODAY = process.env.TODAY ?? "2026-10-31";

type Method = "upi" | "card" | "bank_transfer" | "cash";
type Table = Parameters<typeof db.insert>[0];

const t0 = Date.now();
const log = (msg: string) => console.log(`[seed +${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

/** Multi-row inserts of at most BATCH rows, all inside one transaction per table. */
async function insertAll(table: Table, rows: Record<string, unknown>[], label: string) {
  if (rows.length === 0) return;
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += BATCH) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.insert(table).values(rows.slice(i, i + BATCH) as any);
    }
  });
  log(`${label}: ${rows.length}`);
}

/** Wipe every table (and sequences) so the seed can rebuild from scratch. */
async function resetData() {
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (rows.length > 0) {
    const names = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
    await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
  }
  await db.execute(sql`ALTER SEQUENCE subscription_number_seq RESTART`);
  await db.execute(sql`ALTER SEQUENCE invoice_number_seq RESTART`);
  log("reset: all tables truncated");
}

/** Create (or find) a user through Better Auth so the password hashes correctly. */
async function ensureUser(
  name: string,
  email: string,
  password: string,
  role: "admin" | "staff" | "customer",
): Promise<string> {
  const { auth } = await import("../../lib/auth");
  const [existing] = await db.select().from(user).where(eq(user.email, email));
  if (existing) return existing.id;
  const res = await auth.api.signUpEmail({ body: { name, email, password } });
  if (role !== "customer") await db.update(user).set({ role }).where(eq(user.id, res.user.id));
  return res.user.id;
}

type SeedUsers = { admin: string; staff: string; portal: Map<number, string> };

async function seedUsers(): Promise<SeedUsers> {
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const ids: SeedUsers = {
    admin: await ensureUser("Brightloop Admin", "admin@brightloop.test", password, "admin"),
    staff: await ensureUser("Brightloop Staff", "staff@brightloop.test", password, "staff"),
    portal: new Map<number, string>(),
  };
  for (let i = 1; i <= 5; i++) {
    ids.portal.set(i, await ensureUser(`Portal Customer ${i}`, `customer${i}@brightloop.test`, password, "customer"));
  }
  // Sign-up auto-creates a customers row for every user; the dataset brings its own.
  await db.delete(customers).where(inArray(customers.userId, [ids.admin, ids.staff, ...ids.portal.values()]));
  log("users: admin, staff, customer1..5");
  return ids;
}

async function seedCatalog(data: Dataset) {
  await insertAll(taxes, data.taxes.map((t) => ({ ...t })), "taxes");
  await insertAll(paymentTerms, data.paymentTerms.map((t) => ({ ...t })), "payment_terms");
  await insertAll(
    products,
    data.products.map((p) => ({ id: p.id, name: p.name, type: "service", salesPrice: p.salesPrice, costPrice: p.costPrice })),
    "products",
  );
  await insertAll(productTaxes, data.products.map((p) => ({ productId: p.id, taxId: p.taxId })), "product_taxes");
  await insertAll(productVariants, data.variants.map((v) => ({ ...v })), "product_variants");
  await insertAll(
    plans,
    data.plans.map((p) => ({
      id: p.id, name: p.name, price: p.price, interval: p.interval, intervalCount: p.intervalCount,
      minQty: p.minQty, autoClose: p.autoClose, closable: p.closable, pausable: p.pausable, renewable: p.renewable,
    })),
    "plans",
  );
  await insertAll(
    quotationTemplates,
    data.templates.map((t) => ({ id: t.id, name: t.name, validityDays: t.validityDays, planId: t.planId, paymentTermId: t.paymentTermId })),
    "quotation_templates",
  );
  await insertAll(
    quotationTemplateLines,
    data.templates.flatMap((t) => t.lines.map((l) => ({ templateId: t.id, productId: l.productId, variantId: l.variantId, quantity: l.qty }))),
    "quotation_template_lines",
  );
  await insertAll(
    discounts,
    data.discounts.map((d) => ({
      id: d.id, name: `${d.name} (${d.code})`, kind: d.kind, value: d.value, scope: d.scope,
      startsOn: d.startsOn, endsOn: d.endsOn, usageLimit: d.usageLimit, usedCount: d.usedCount,
    })),
    "discounts",
  );
  await insertAll(
    discountProducts,
    data.discounts.filter((d) => d.productId).map((d) => ({ discountId: d.id, productId: d.productId })),
    "discount_products",
  );
}

const asDate = (ymd: string) => new Date(`${ymd}T10:00:00Z`);
const addressOf = (c: { city: string; state: string; pincode: string }) => `${c.city}, ${c.state} - ${c.pincode}`;

async function seedSubscriptions(data: Dataset, ids: SeedUsers) {
  await insertAll(
    customers,
    data.customers.map((c) => ({
      id: c.id,
      userId: c.portalIndex ? (ids.portal.get(c.portalIndex) ?? null) : null,
      name: c.name,
      email: c.email,
      company: c.company,
      phone: c.phone,
      address: addressOf(c),
      gstin: c.gstin,
    })),
    "customers",
  );
  await insertAll(
    subscriptions,
    data.subscriptions.map((s) => ({
      id: s.id, number: s.number, customerId: s.customerId, planId: s.planId, status: s.status,
      startDate: s.startDate, expiryDate: s.expiryDate, nextInvoiceDate: s.nextInvoiceDate,
      paymentTermId: s.paymentTermId, quotationValidUntil: s.quotationValidUntil, templateId: s.templateId,
      createdBy: ids.admin, createdAt: asDate(s.startDate), updatedAt: asDate(s.startDate),
    })),
    "subscriptions",
  );
  await insertAll(
    subscriptionLines,
    data.subscriptionLines.map((l) => ({
      id: l.id, subscriptionId: l.subscriptionId, productId: l.productId, variantId: l.variantId,
      quantity: l.qty, unitPrice: l.unitPrice,
    })),
    "subscription_lines",
  );
  await insertAll(
    activityLog,
    data.statusHistory.map((h) => ({
      entityType: "subscription", entityId: h.subscriptionId, action: "status_change",
      fromStatus: h.from, toStatus: h.to, actorId: ids.admin, at: asDate(h.at), meta: { seeded: true },
    })),
    "activity_log",
  );
}

async function seedBilling(data: Dataset) {
  const rng = createRng(SEED ^ 0x51ed270b);
  const idRng = createRng(SEED ^ 0x7f4a7c15);
  const recentFrom = addInterval(TODAY, "monthly", -2);

  const customerById = new Map(data.customers.map((c) => [c.id, c]));
  const termDays = new Map(data.paymentTerms.map((p) => [p.id, p.dueDays]));
  const productById = new Map(data.products.map((p) => [p.id, p]));
  const taxRate = new Map(data.taxes.map((t) => [t.id, t.rateBps]));
  const variantById = new Map(data.variants.map((v) => [v.id, v]));
  const subById = new Map<string, SubscriptionRow>(data.subscriptions.map((s) => [s.id, s]));
  const linesBySub = new Map<string, Dataset["subscriptionLines"]>();
  for (const l of data.subscriptionLines) {
    const list = linesBySub.get(l.subscriptionId) ?? [];
    list.push(l);
    linesBySub.set(l.subscriptionId, list);
  }

  // Lines are fixed per subscription and history has no discounts, so price once per subscription.
  const pricedBySub = new Map<string, ReturnType<typeof price>>();
  for (const [subId, lines] of linesBySub) {
    pricedBySub.set(
      subId,
      price({
        on: TODAY,
        discounts: [],
        lines: lines.map((l) => {
          const rate = taxRate.get(productById.get(l.productId)!.taxId) ?? 0;
          return {
            key: l.id,
            productId: l.productId,
            quantity: l.qty,
            unitPrice: l.unitPrice,
            taxRatesBps: rate > 0 ? [rate] : [],
          };
        }),
      }),
    );
  }

  const periods = [...data.billingPeriods].sort((a, b) =>
    a.periodStart !== b.periodStart
      ? a.periodStart < b.periodStart ? -1 : 1
      : a.subscriptionId < b.subscriptionId ? -1 : 1,
  );

  const invoiceRows: Record<string, unknown>[] = [];
  const lineRows: Record<string, unknown>[] = [];
  const paymentRows: Record<string, unknown>[] = [];
  const methods = [
    { value: "upi" as Method, weight: 45 },
    { value: "bank_transfer" as Method, weight: 25 },
    { value: "card" as Method, weight: 20 },
    { value: "cash" as Method, weight: 10 },
  ];

  periods.forEach((p, idx) => {
    const sub = subById.get(p.subscriptionId)!;
    const priced = pricedBySub.get(p.subscriptionId);
    if (!priced) return;
    const customer = customerById.get(sub.customerId)!;
    const invId = idRng.uuid();
    const issuedOn = p.periodStart;
    const dueDate = addDays(issuedOn, termDays.get(sub.paymentTermId) ?? 0);

    // Status mix: older invoices mostly paid, the last two months a mix.
    // There is no "overdue"/"partial" status: both are confirmed invoices (past due / amount_paid < total).
    let status: "paid" | "confirmed" | "cancelled" = "confirmed";
    let paidShare = 0;
    const roll = rng.next();
    if (roll < 0.005) status = "cancelled";
    else if (issuedOn >= recentFrom) {
      if (roll < 0.55) { status = "paid"; paidShare = 1; }
      else if (roll < 0.65) paidShare = 0.2 + rng.next() * 0.6;
    } else if (roll < 0.93) { status = "paid"; paidShare = 1; }
    else if (roll < 0.98) paidShare = 0.2 + rng.next() * 0.6;

    const total = priced.total;
    const amountPaid = status === "cancelled" ? 0 : paidShare === 1 ? total : Math.floor(total * paidShare);

    invoiceRows.push({
      id: invId,
      number: `INV-${String(idx + 1).padStart(5, "0")}`,
      subscriptionId: sub.id,
      customerId: sub.customerId,
      customerSnapshot: {
        name: customer.name, company: customer.company, email: customer.email,
        address: addressOf(customer), gstin: customer.gstin,
      },
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      status,
      issuedOn,
      dueDate,
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      taxTotal: priced.taxTotal,
      total,
      amountPaid,
      createdAt: asDate(issuedOn),
      updatedAt: asDate(issuedOn),
    });

    (linesBySub.get(sub.id) ?? []).forEach((l, i) => {
      const pl = priced.lines[i]!;
      const variant = l.variantId ? variantById.get(l.variantId) : undefined;
      lineRows.push({
        id: idRng.uuid(),
        invoiceId: invId,
        productId: l.productId,
        description: productById.get(l.productId)!.name,
        variantLabel: variant ? `${variant.attribute}: ${variant.value}` : null,
        quantity: l.qty,
        unitPrice: l.unitPrice,
        taxRateBps: pl.taxRateBps,
        discountAmount: pl.discount,
        taxAmount: pl.tax,
        lineTotal: pl.total,
      });
    });

    if (amountPaid > 0) {
      const settleBy = addDays(dueDate, 15);
      const lastDay = settleBy < TODAY ? settleBy : TODAY;
      const firstDay = issuedOn < lastDay ? issuedOn : lastDay;
      const split = paidShare === 1 && amountPaid > 1000 && rng.chance(0.12);
      const head = split ? Math.floor(amountPaid * (0.3 + rng.next() * 0.4)) : amountPaid;
      const amounts = split ? [head, amountPaid - head] : [head];
      let day = rng.date(firstDay, lastDay);
      for (const amount of amounts) {
        paymentRows.push({
          id: idRng.uuid(), invoiceId: invId, method: rng.weighted(methods), amount, paidOn: day,
          createdAt: asDate(day),
        });
        const room = daysBetween(day, lastDay);
        day = room > 0 ? addDays(day, rng.int(0, room)) : day;
      }
    }
  });

  await insertAll(invoices, invoiceRows, "invoices");
  await insertAll(invoiceLines, lineRows, "invoice_lines");
  await insertAll(payments, paymentRows, "payments");

  await db.execute(sql`select setval('subscription_number_seq', ${data.subscriptions.length}, true)`);
  await db.execute(sql`select setval('invoice_number_seq', ${Math.max(invoiceRows.length, 1)}, true)`);
  log(`sequences bumped: subscription ${data.subscriptions.length}, invoice ${invoiceRows.length}`);
}

async function main() {
  if (process.argv.includes("--reset")) await resetData();

  const ids = await seedUsers();

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(subscriptions);
  if (n > 0) {
    log(`dataset already present (${n} subscriptions); run with --reset to rebuild`);
    return;
  }

  const data = generateDataset({ seed: SEED, today: TODAY, customers: 400, subscriptions: 5000 });
  log(`generated ${data.subscriptions.length} subscriptions, ${data.billingPeriods.length} billing periods`);
  await seedCatalog(data);
  await seedSubscriptions(data, ids);
  await seedBilling(data);
  log("done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
