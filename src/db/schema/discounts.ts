import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./catalog";
import { discountKind, discountScope } from "./enums";
import { invoices } from "./invoices";

export const discounts = pgTable("discounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: discountKind("kind").notNull(),
  // paise for fixed, basis points for percent
  value: integer("value").notNull(),
  scope: discountScope("scope").notNull().default("subscription"),
  minAmount: integer("min_amount"),
  minQty: integer("min_qty"),
  startsOn: date("starts_on", { mode: "string" }),
  endsOn: date("ends_on", { mode: "string" }),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const discountProducts = pgTable(
  "discount_products",
  {
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.discountId, t.productId] })],
);

export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("discount_redemptions_uq").on(t.discountId, t.invoiceId)],
);

export type Discount = typeof discounts.$inferSelect;
export type DiscountRedemption = typeof discountRedemptions.$inferSelect;
