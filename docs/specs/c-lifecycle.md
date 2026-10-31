# Lane C: lifecycle, discounts, payments (Yasin) — branches `feat/04-state-machine`, then `feat/08-subscriptions`, `feat/13-discounts-payments`

Read `docs/specs/conventions.md` and `docs/team-plan.md` §1 first. You own `src/server/state-machine/**`, `src/server/activity-log.ts`, `src/features/{subscriptions,discounts,payments}/**`, `src/db/schema/{subscriptions,discounts,payments,activity}.ts`.

## Part 1 — state machine (do first; lane A's billing and lane D's portal call it)
`src/server/state-machine/`
- `subscription.ts` (pure): transitions with guards using `ctx: { plan: { closable, pausable, renewable, autoClose } }`:
  - draft → quotation ("send_quotation"), draft → closed ("cancel")
  - quotation → confirmed ("confirm"), quotation → draft ("revise"), quotation → closed ("cancel")
  - confirmed → active ("activate")
  - active → paused ("pause", requires plan.pausable), paused → active ("resume")
  - active → closed ("close": requires plan.closable, unless `system: true` — expiry/auto-close), paused → closed (same guard)
  - `renew` is not a status change (handled in service).
  - `canTransitionSubscription(from, to, ctx) → { ok: true } | { ok: false; reason: string }`, `availableSubscriptionActions(status, ctx) → { action, to, label }[]` (labels: "Send quotation", "Confirm", "Activate", "Pause", "Resume", "Close", "Cancel", "Revise").
- `invoice.ts` (pure): draft → confirmed ("confirm"), draft → cancelled ("cancel"), confirmed → cancelled ("cancel", only when amountPaid = 0), confirmed → paid ("mark_paid", only when amountPaid ≥ total). `canTransitionInvoice`, `availableInvoiceActions`.
- `index.ts` (DB): `transitionSubscription(tx, { id, to, actor: Actor | null, system?: boolean, reason?: string })` — `SELECT … FOR UPDATE`, load plan, check, `UPDATE` status (+ side effects: on **active** set `next_invoice_date = coalesce(next_invoice_date, start_date)`; on **closed** set `next_invoice_date = null`; on **quotation** set `quotation_valid_until` if null from template validity or +30 days), then `logActivity`. Same for `transitionInvoice(tx, { id, to, actor, system? })`. Throws `InvalidTransitionError(entity, from, to, reason)`. These are the **only** places that write `status`.
- `src/server/activity-log.ts`: `logActivity(tx, { entityType: "subscription" | "invoice" | "payment" | "discount" | …, entityId, action, fromStatus?, toStatus?, actorId?, meta? })`; `listActivity(db, entityType, entityId)` newest first, joined with user name → `{ at, action, fromStatus, toStatus, actorName, meta }[]`.
- Tests: every allowed transition, every forbidden one, each guard; DB tests for row update + activity row written + side effects + concurrent safety (FOR UPDATE).

## Part 2 — subscriptions `src/features/subscriptions/`
- `schemas.ts`: `subscriptionInput` {customerId, planId, startDate, expiryDate|null (≥ start), paymentTermId, lines: {productId, variantId|null, quantity ≥ plan.minQty? (validate in service), unitPrice? (optional override, else catalog price)}[] min 1}.
- `service.ts`: `createSubscription` (status draft, `number` = `SUB-` + 4-digit zero-padded `nextval('subscription_number_seq')`), `createFromTemplate(db, { templateId, customerId, startDate }, actor)` (copies plan, terms, lines; `quotation_valid_until = startDate + validityDays`), `updateSubscription` (only in draft/quotation), `applyAction(db, { id, action }, actor)` → maps action to target status and calls `transitionSubscription`, `renewSubscription` (plan.renewable; extends `expiry_date` by one plan period; activity "renewed"). Unit prices via lane B's `lineUnitPrice(db, productId, variantId)` from `@/features/catalog/queries`.
- `queries.ts`: `listSubscriptions(db, ListParams & { status?, customerId?, planId?, view?: "all" | "active" | "paused" | "due_today" | "closing_this_month" | "quotations" , today })` → `Paged<{ id, number, customerName, planName, status, startDate, expiryDate, nextInvoiceDate, recurringTotal }>` — `recurringTotal` = sum(qty × unit_price) in SQL. `getSubscription(db, id)` → header + customer + plan + lines (with product name, variant label) + `availableActions` + `activity`. `quoteSubscription(db, id, on)` → `price()` result for the current lines with applicable discounts (uses `@/server/pricing` and `listApplicableDiscounts`). `subscriptionCounts(db, today)` → `{ dueToday, active, paused, quotations }` (nav chips).
- Tests: create, from template, number format/uniqueness, edit lock after confirm, each action through the service, list filters/views, min-qty validation.

## Part 3 — discounts `src/features/discounts/` (admin only, every function)
- `schemas.ts`: `discountInput` {name, kind fixed|percent, value (paise or bps; percent ≤ 10000), scope products|subscription, productIds (required non-empty if scope=products), minAmount?, minQty?, startsOn?, endsOn? (≥ startsOn), usageLimit?, active}.
- `service.ts`: create/update/archive; `redeemDiscounts(tx, invoiceId, applied: { discountId, amount }[])` → inserts `discount_redemptions` (unique pair; ignore conflict) and increments `used_count` **with `WHERE usage_limit IS NULL OR used_count < usage_limit`** — returns ids that failed the limit (lane A's billing then reprices without them).
- `queries.ts`: `listDiscounts(db, ListParams)` with `status: "active" | "scheduled" | "expired" | "used_up" | "inactive"` derived in SQL; `getDiscount`; **`listApplicableDiscounts(db, { productIds: string[]; on: string }) → DiscountRule[]`** (shape from `src/server/pricing`; active, in date window, not used up, scope subscription or overlapping productIds).
- Tests incl. the usage-limit race (two redemptions at limit−1 → only one succeeds).

## Part 4 — payments `src/features/payments/`
- `schemas.ts`: `paymentInput` {invoiceId, method upi|card|bank_transfer|cash, amount > 0, paidOn date ≤ today, note ≤ 500}.
- `service.ts`: `recordPayment(tx, input, actor)` — invoice must be **confirmed**; amount ≤ balance (`total − amount_paid`); insert payment; `amount_paid += amount`; if now ≥ total → `transitionInvoice(… to "paid")`; `logActivity("payment", …)`. `deletePayment(tx, id, actor)` (admin; only while invoice not paid… or reverse paid → confirmed is not allowed by the machine, so only for unpaid invoices) — supports the Undo toast.
- `queries.ts`: `listPayments(db, ListParams & { method?, from?, to?, customerId? })` → rows with invoice number + customer; `invoiceBalance(db, invoiceId)`; `listOutstanding(db, ListParams & { overdueOnly?, today })` → confirmed invoices with balance > 0, `daysOverdue`.
- Tests: partial then full payment → paid; overpay rejected; payment on draft rejected; delete payment.

## Commits (Yasin commits and pushes from bababooyii)
`feat(state-machine): subscription and invoice transition rules` · `feat(state-machine): transactional transitions with activity log` · `feat(subscriptions): service and numbering` · `feat(subscriptions): list, record and quote queries` · `feat(discounts): admin discount rules and redemption` · `feat(payments): record payments and outstanding view`.
Hourly: PR by :30, merged by :50. Part 1 is its own PR first.
