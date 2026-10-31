import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { billingInterval, productType } from "./enums";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  phone: text("phone"),
  address: text("address"),
  gstin: text("gstin"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: productType("type").notNull().default("service"),
  salesPrice: integer("sales_price").notNull().default(0),
  costPrice: integer("cost_price").notNull().default(0),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  attribute: text("attribute").notNull(),
  value: text("value").notNull(),
  extraPrice: integer("extra_price").notNull().default(0),
});

export const taxes = pgTable("taxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  rateBps: integer("rate_bps").notNull(),
  active: boolean("active").notNull().default(true),
});

export const productTaxes = pgTable(
  "product_taxes",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    taxId: uuid("tax_id")
      .notNull()
      .references(() => taxes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.taxId] })],
);

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  price: integer("price").notNull().default(0),
  interval: billingInterval("interval").notNull().default("monthly"),
  intervalCount: integer("interval_count").notNull().default(1),
  minQty: integer("min_qty").notNull().default(1),
  availableFrom: date("available_from", { mode: "string" }),
  availableTo: date("available_to", { mode: "string" }),
  autoClose: boolean("auto_close").notNull().default(false),
  closable: boolean("closable").notNull().default(true),
  pausable: boolean("pausable").notNull().default(true),
  renewable: boolean("renewable").notNull().default(true),
  active: boolean("active").notNull().default(true),
});

export const paymentTerms = pgTable("payment_terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  dueDays: integer("due_days").notNull().default(0),
});

export const quotationTemplates = pgTable("quotation_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  validityDays: integer("validity_days").notNull().default(30),
  planId: uuid("plan_id").references(() => plans.id),
  paymentTermId: uuid("payment_term_id").references(() => paymentTerms.id),
  notes: text("notes"),
});

export const quotationTemplateLines = pgTable("quotation_template_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => quotationTemplates.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id),
  quantity: integer("quantity").notNull().default(1),
});

export type Customer = typeof customers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Tax = typeof taxes.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PaymentTerm = typeof paymentTerms.$inferSelect;
export type QuotationTemplate = typeof quotationTemplates.$inferSelect;
export type QuotationTemplateLine = typeof quotationTemplateLines.$inferSelect;
