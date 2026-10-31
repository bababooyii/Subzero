import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import {
  customers,
  paymentTerms,
  plans,
  productVariants,
  products,
  quotationTemplates,
} from "./catalog";
import { subscriptionStatus } from "./enums";

export const subscriptionNumberSeq = pgSequence("subscription_number_seq");

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull().unique(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatus("status").notNull().default("draft"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    expiryDate: date("expiry_date", { mode: "string" }),
    nextInvoiceDate: date("next_invoice_date", { mode: "string" }),
    paymentTermId: uuid("payment_term_id").references(() => paymentTerms.id),
    quotationValidUntil: date("quotation_valid_until", { mode: "string" }),
    templateId: uuid("template_id").references(() => quotationTemplates.id),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_status_idx").on(t.status),
    index("subscriptions_status_next_invoice_idx").on(
      t.status,
      t.nextInvoiceDate,
    ),
    index("subscriptions_customer_idx").on(t.customerId),
    index("subscriptions_number_trgm_idx").using("gin", sql`${t.number} gin_trgm_ops`),
  ],
);

export const subscriptionLines = pgTable(
  "subscription_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull(),
  },
  (t) => [index("subscription_lines_subscription_idx").on(t.subscriptionId)],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type SubscriptionLine = typeof subscriptionLines.$inferSelect;
