# Lane B: catalog & customers (Vishnu) — branch `feat/05-catalog-core`

Read `docs/specs/conventions.md` and `docs/team-plan.md` §1 first. You own `src/features/{catalog,customers}/**` and `src/db/schema/catalog.ts` (schema changes only if truly needed; report them).

## Roles
Catalog writes (products, variants, plans, taxes, payment terms, templates): **admin only**. Catalog reads: admin + staff. Customers: admin + staff read/write.

## `src/features/catalog/`
- `schemas.ts` (Zod): `productInput` {name 1–120, type service|goods, salesPrice ≥0 int paise, costPrice ≥0 int, notes ≤2000 optional, taxIds uuid[], variants: {id?, attribute 1–60, value 1–60, extraPrice int ≥0}[]}; `planInput` {name, price ≥0, interval daily|weekly|monthly|yearly, intervalCount 1–36, minQty ≥1, availableFrom date, availableTo date|null (≥ availableFrom), autoClose, closable, pausable, renewable}; `taxInput` {name, rateBps 0–10000}; `paymentTermInput` {name, dueDays 0–365}; `templateInput` {name, validityDays 1–365, planId, paymentTermId, notes?, lines: {productId, variantId|null, quantity ≥1}[] min 1}. Inputs accept money as integer paise (the UI converts rupees).
- `service.ts`:
  - `createProduct`, `updateProduct(id, input)` — upsert variants in the same transaction (delete removed ones, update/insert others), replace `product_taxes`. `archiveProduct(id)` sets active=false (never hard delete: invoices snapshot but subscriptions reference products).
  - `createPlan`, `updatePlan`, `archivePlan`. `isPlanAvailable(plan, on)` pure helper (+ unit tests).
  - `createTax`, `updateTax`, `archiveTax`; `createPaymentTerm`, `updatePaymentTerm`.
  - `createTemplate`, `updateTemplate` (replace lines), `archiveTemplate`? (no `active` column on templates → just `deleteTemplate` if unused by subscriptions, else error).
- `queries.ts`:
  - `listProducts(db, ListParams & { type?, active? })` → `Paged<{ id, name, type, salesPrice, costPrice, variantCount, active }>`; sort by name|salesPrice|createdAt; `q` = ILIKE on name.
  - `getProduct(db, id)` → product + `variants[]` + `taxes[]` (id, name, rateBps).
  - `listPlans(db, ListParams & { active? })`, `getPlan`.
  - `listTaxes(db)`, `listPaymentTerms(db)` (small, unpaged).
  - `listTemplates(db, ListParams)`, `getTemplate(db, id)` → template + plan + lines with product name, variant label, unit price (salesPrice + extraPrice).
  - `productOptions(db)` → for pickers: `{ id, name, salesPrice, taxRatesBps: number[], variants: { id, label: "Brand: Odoo", extraPrice }[] }[]` (active only).
  - **`lineUnitPrice(db, productId, variantId | null)`** → `{ unitPrice, taxRatesBps, description, variantLabel }`. Lane A (billing) and lane C (subscriptions) call this; keep the name and shape.
- `actions.ts`: one `"use server"` action per service function (admin-only writes), returning `ActionResult`.

## `src/features/customers/`
- `schemas.ts`: `customerInput` {name, email, company?, phone?, address?, gstin? (15-char GSTIN regex, optional)}.
- `service.ts`: `createCustomer`, `updateCustomer` (email unique among customers → field error). Customers created by sign-up already exist (CORE-01 hook); staff-created ones have `user_id` null.
- `queries.ts`: `listCustomers(db, ListParams)` → rows with `activeSubscriptions` count and `outstanding` (sum of confirmed invoices `total − amount_paid`) computed in SQL with grouped subqueries (no N+1); `getCustomer(db, id)` → customer + counts + outstanding. (Subscriptions/invoices lists for the record page come from lanes C/A by `customerId` filter.)
- `actions.ts` (admin + staff).

## Tests
DB tests for every service function (happy path + one validation/guard), the variant upsert (removing/updating/adding), `lineUnitPrice` (variant extra added: Odoo +56000 paise), `listCustomers` outstanding maths, pagination/sort/search on `listProducts`. Unit tests for `isPlanAvailable` and schemas (GSTIN, availableTo ≥ availableFrom).

## Commit plan (Vishnu commits and pushes these from vishnuu-kr, roughly one per bullet)
1. `feat(catalog): zod schemas for catalog and customers`
2. `feat(catalog): product and variant service + queries`
3. `feat(catalog): plans, taxes, payment terms`
4. `feat(catalog): quotation templates and lineUnitPrice`
5. `feat(customers): customer service and list with outstanding`
6. `feat(catalog): server actions with role guards`

Hourly: open a PR with whatever is done and green by :30, merged by :50.
