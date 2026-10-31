import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { paymentMethod } from "./enums";
import { invoices } from "./invoices";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    method: paymentMethod("method").notNull(),
    amount: integer("amount").notNull(),
    paidOn: date("paid_on", { mode: "string" }).notNull(),
    note: text("note"),
    recordedBy: text("recorded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_paid_on_idx").on(t.paidOn),
  ],
);

export type Payment = typeof payments.$inferSelect;
