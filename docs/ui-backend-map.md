# UI → backend map (for the UI chat)

The backend is on `main` (foundation) plus PRs #2–#4 and the integration branch `feat/07-integration`. Screens currently read `src/lib/mock/selectors*.ts`. Swap each call for the real function below.

## Conventions
- Pages are server components: `import { db } from "@/db/client"` and `await` the query. Reads take `db` first.
- Money is integer **paise**; dates are `YYYY-MM-DD` strings. Format with your `src/lib/format.ts`.
- Lists are server-paged: params `{ page, pageSize, q, sort, dir, ...filters }` → `Paged<T> = { rows, total, page, pageSize }`. Keep the params in the URL (`searchParams`) and drop client-side paging in `DataTable`.
- Writes are server actions returning `ActionResult<T> = { ok: true, data } | { ok: false, error, fieldErrors? }`. Show `fieldErrors` under fields and `error` in a toast.
- "Today": use `todayIST()` from `@/lib/dates` instead of the mock clock.
- **Pricing:** delete `src/lib/mock/pricing.ts` and use `price()` from `@/server/pricing`. The project has exactly one pricing function.
- **Auth:** replace the demo role switcher with the real session. On the server: `getSession()` / `requireActor(...roles)` from `@/lib/auth/session`. On the client: `createAuthClient()` from `better-auth/react`, with `signIn.email`, `signUp.email`, `requestPasswordReset` and `resetPassword`. Password rules for the live checklist are in `passwordRules` in `@/lib/auth/password`.

## Reads

| Mock selector | Real function |
|---|---|
| `getCustomer(id)` | `getCustomer(db, id)`, `@/features/customers/queries` |
| `listCustomers(q)` | `listCustomers(db, { q, page, sort })` (includes `activeSubscriptions` and `outstanding`) |
| `getProduct(id)` / `listProducts()` | `getProduct(db, id)` / `listProducts(db, params)`, `@/features/catalog/queries` |
| `getPlan(id)` / `listPlans()` | `getPlan(db, id)` / `listPlans(db, params)` |
| `listTemplates()` | `listTemplates(db, params)`, `getTemplate(db, id)` |
| `listTaxes()` | `listTaxes(db)`; payment terms: `listPaymentTerms(db)` |
| product pickers | `productOptions(db)`; line price: `lineUnitPrice(db, productId, variantId)` |
| `listDiscounts()` | `listDiscounts(db, { ...params, today })`, `@/features/discounts/queries` |
| `getSubscription(id)` | `getSubscription(db, id)`, `@/features/subscriptions/queries` (includes `availableActions` and `activity`) |
| `listSubscriptions(filter)`, `isDueToday` | `listSubscriptions(db, { view: "all"\|"active"\|"paused"\|"due_today"\|"closing_this_month"\|"quotations", status, customerId, planId, today, ...paging })` |
| `subscriptionTotals(sub)` | `quoteSubscription(db, id, today)` (the `price()` result with applicable discounts) |
| `getInvoice(id)` | `getInvoice(db, id, { today, deps: invoiceDeps })`, `@/features/invoices/queries` + `deps` |
| `listInvoices(filter)`, `invoiceBalance`, `isOverdue`, `invoiceDisplayStatus` | `listInvoices(db, { view: "all"\|"draft"\|"unpaid"\|"overdue"\|"paid", ...})`; each row carries `balance` and `displayStatus` |
| `daysOverdue` | `listOutstanding(db, { today, overdueOnly })`, `@/features/payments/queries` |
| `listPayments(filter)` | `listPayments(db, { method, from, to, customerId, q, ...paging })` |
| `dueForBilling()` | `previewBillingAction()`, `@/features/billing/actions` (integration branch) |
| `dashboardKpis(planId)` | `dashboardKpis(db, { from, to, planId, today })`, `@/features/dashboard/queries` |
| `revenueByMonth` / `revenueByPeriod` | `revenueByMonth(db, { months, planId, today })` → `{ month, invoiced, collected }[]` |
| `overdueAgeing(planId)` | `overdueAgeing(db, { today })` |
| `overdueInvoices(limit)` | `overdueInvoices(db, { limit, today })` |
| `sidebarCounts()` | `navCounts(db, today)` → `{ dueToday, overdueInvoices }` |
| `entityActivity(entity, id)` | `listActivity(db, entityType, entityId)`, `@/server/activity-log` |
| `customerPortalData(customerId)` | `mySubscriptions(db, actor)`, `myInvoices(db, actor, params)`, `getMyInvoice(db, actor, id)`, `@/features/portal/queries` |
| print view | `getInvoiceForPrint(db, actor, id)` |
| `recentActivity()`, `searchIndex()`, `listUsers()` | **not built yet.** Keep the mock or hide the feature; ask the hub. |

## Writes (server actions)

| Screen | Action |
|---|---|
| Products, plans, taxes, payment terms, templates | `@/features/catalog/actions`: `create/update/archive{Product,Plan,Tax}Action`, `create/updatePaymentTermAction`, `create/update/deleteTemplateAction` (admin only) |
| Customers | `createCustomerAction`, `updateCustomerAction` |
| Subscription editor and record | `@/features/subscriptions/actions`: `createSubscriptionAction`, `createFromTemplateAction`, `updateSubscriptionAction`, `applySubscriptionAction({ id, action })` (send_quotation, confirm, activate, pause, resume, close, cancel, revise), `renewSubscriptionAction` |
| Discounts | `@/features/discounts/actions` (admin only) |
| Billing run | `runBillingAction()`; the deck reads `previewBillingAction()` |
| Invoices | `@/features/invoices/actions`: confirm, cancel, send, bulk confirm, bulk send |
| Record payment dialog | `recordPaymentAction({ invoiceId, method, amount, paidOn, note })`; Undo → `deletePaymentAction` (admin) |
| Portal | `pauseMySubscription`, `resumeMySubscription`, `cancelMySubscription` actions, `@/features/portal/actions` |
| Settings → staff | `createStaffUser` in `@/features/users/actions` (admin only) |

## Demo data
`pnpm demo:reset` migrates and seeds 5,000 subscriptions. Logins (password `SEED_ADMIN_PASSWORD`, default in `.env.example`): `admin@brightloop.test`, `staff@brightloop.test`, `customer1..5@brightloop.test`.
