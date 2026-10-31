import {
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { customers, products } from "./catalog";
import { invoiceStatus } from "./enums";
import { subscriptions } from "./subscriptions";

export const invoiceNumberSeq = pgSequence("invoice_number_seq");

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    customerSnapshot: jsonb("customer_snapshot").notNull(),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    issuedOn: date("issued_on", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    subtotal: integer("subtotal").notNull().default(0),
    discountTotal: integer("discount_total").notNull().default(0),
    taxTotal: integer("tax_total").notNull().default(0),
    total: integer("total").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("invoices_subscription_period_uq").on(t.subscriptionId, t.periodStart),
    index("invoices_status_due_idx").on(t.status, t.dueDate),
    index("invoices_issued_on_idx").on(t.issuedOn),
    index("invoices_customer_idx").on(t.customerId),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    variantLabel: text("variant_label"),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId)],
);

export const billingRuns = pgTable("billing_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runDate: date("run_date", { mode: "string" }).notNull(),
  createdCount: integer("created_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  startedBy: text("started_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type BillingRun = typeof billingRuns.$inferSelect;
