CREATE INDEX "customers_name_trgm_idx" ON "customers" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "customers_email_trgm_idx" ON "customers" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "subscriptions_number_trgm_idx" ON "subscriptions" USING gin ("number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "invoices_number_trgm_idx" ON "invoices" USING gin ("number" gin_trgm_ops);