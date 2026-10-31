# Lane D: seed, dashboard, portal, perf (Don) — branches `feat/06-seed`, then `feat/10-dashboard`, `feat/14-portal`

Read `docs/specs/conventions.md` and `docs/team-plan.md` §1 first. You own `src/db/seed/**`, `src/features/{dashboard,portal}/**`, `scripts/perf.ts`. No new dependencies (write a tiny seeded PRNG, e.g. mulberry32, in `src/db/seed/rng.ts`).

## Part 1 — seed `src/db/seed/`
`pnpm db:seed` (keep the admin user the stub creates) builds a deterministic dataset with `SEED=42`, `TODAY=2026-10-31`:
- users: admin `admin@brightloop.test`, staff `staff@brightloop.test` (password from `SEED_ADMIN_PASSWORD`), 5 portal customers `customer1..5@brightloop.test` linked to customers rows. Create users through Better Auth's API/internal adapter so passwords hash correctly (one call each is fine; only 7 users).
- catalog: 4 taxes (GST 18%, 12%, 5%, Exempt), 3 payment terms (Immediate, 15 days, 30 days), ~20 products (Indian SaaS / add-on names) incl. "Brightloop ERP" with variants Brand: Odoo (+56000), Brand: Generic (+0); 8 plans across daily/weekly/monthly/yearly (most monthly/yearly), 4 quotation templates, 6 discounts (one expired, one used up, one product-scoped, one percent subscription-wide).
- 400 customers; **5,000 subscriptions** across statuses (≈70% active, 8% paused, 10% closed, rest draft/quotation/confirmed), start dates over the last 18 months, 1–4 lines each.
- invoices for every past period of active/paused/closed subs (≈ 50k), periods computed with `src/lib/dates.ts` `addInterval`, totals computed with `price()` from `src/server/pricing` (no discounts needed in history except a few), statuses: older ones mostly paid, some partly paid, last 2 months mix of confirmed/overdue/paid; ~14 active subs with `next_invoice_date = TODAY` (billing-run demo).
- payments for paid/partly-paid invoices (methods spread), `amount_paid` consistent with payments.
- activity_log rows for the subscription status history (one per transition) — seed may write status directly (the seed is exempt from the state-machine rule; `scripts/check-status-writes.sh` only scans `src/features` and `src/server`).
- Set `subscription_number_seq` / `invoice_number_seq` past the max used number.
- Performance: multi-row inserts in batches of 1,000 inside one transaction per table; whole seed < 60 s. Log counts and timing.
- `pnpm db:seed` must be idempotent-by-reset: it calls reset first only with `--reset`; `pnpm demo:reset` = reset + migrate + seed (add the script to package.json — the one allowed edit outside your lane; tell Labeeb in the PR).

## Part 2 — dashboard `src/features/dashboard/queries.ts`
All aggregate in SQL, each < 300 ms on the seed (verify):
- `dashboardKpis(db, { from, to, planId?, today })` → `{ activeSubscriptions, mrr, collected, outstanding, overdue: { count, amount }, deltas: { activeSubscriptions, mrr, collected } }` — MRR normalises each active sub's recurring total to monthly (daily ×30, weekly ×52/12, yearly /12, divided by interval_count), integer paise; deltas vs the previous period of the same length.
- `revenueByMonth(db, { months = 12, planId?, today })` → `{ month: "2026-10", invoiced, collected }[]` (zero-filled with generate_series).
- `overdueAgeing(db, { today })` → `{ bucket: "0-30" | "31-60" | "60+", count, amount }[]`.
- `overdueInvoices(db, { limit = 8, today })` → `{ id, number, customerName, dueDate, daysOverdue, balance }[]`.
- `navCounts(db, today)` → `{ dueToday, overdueInvoices }` for the sidebar chips.
- Index additions if a query is slow: report them (index lives in the owner's schema file; we land them in `feat/16-perf`).
- DB tests on a small fixture (not the 5k seed) checking the maths (MRR normalisation, ageing buckets, zero-filled months).

## Part 3 — portal `src/features/portal/`
Customer-only (`requireActor("customer")`), resolve the customers row via `customers.user_id = actor.id`:
- `mySubscriptions(db, actor)` → each with plan, next billing date, recurring amount, status, `canPause`, `canCancel` (from plan flags + status via `availableSubscriptionActions`).
- `myInvoices(db, actor, ListParams)`; `getMyInvoice(db, actor, id)` → **404-style null for someone else's invoice**.
- actions `pauseMySubscription`, `resumeMySubscription`, `cancelMySubscription` → lane C's `transitionSubscription` (close) with the customer as actor; only when allowed.
- `getInvoiceForPrint(db, actor, id)` → everything the print view needs (company block, customer snapshot, lines, totals, payments); staff/admin any invoice, customer only their own.
- Tests: scoping (customer A cannot read or act on B's subscription/invoice), pause allowed only when plan.pausable.

## Part 4 — perf `scripts/perf.ts`
`pnpm perf` (add script): against the seeded DB, runs each dashboard query and the main list queries (subscriptions, invoices, payments, customers page 1 and page 50, with a search) 5× and prints p50/max in ms; exits 1 if any max > 500 ms. Numbers go into the README.

## Commits (Don commits and pushes from Rickasslee)
`feat(seed): deterministic PRNG and catalog seed` · `feat(seed): 5k subscriptions with invoice history and payments` · `feat(dashboard): KPI, revenue, ageing and overdue queries` · `feat(portal): customer-scoped subscriptions and invoices` · `feat(perf): query timing script`.
Hourly: PR by :30, merged by :50.
