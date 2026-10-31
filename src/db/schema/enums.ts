import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "staff", "customer"]);
export const productType = pgEnum("product_type", ["service", "goods"]);
export const billingInterval = pgEnum("billing_interval", [
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "draft",
  "quotation",
  "confirmed",
  "active",
  "paused",
  "closed",
]);
export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "confirmed",
  "paid",
  "cancelled",
]);
export const discountKind = pgEnum("discount_kind", ["fixed", "percent"]);
export const discountScope = pgEnum("discount_scope", [
  "products",
  "subscription",
]);
export const paymentMethod = pgEnum("payment_method", [
  "upi",
  "card",
  "bank_transfer",
  "cash",
]);
