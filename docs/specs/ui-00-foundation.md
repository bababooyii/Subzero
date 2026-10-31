# UI-00 Foundation spec

This is a UI-first build. **All data is mock data** for now: no database, auth or API. Every screen reads typed mock data through selector functions, so the hub can swap in real queries later without touching components.

Read `docs/design-system.md` and `docs/design-adaptation.md` in full before starting. Where they disagree, the adaptation wins. A **sidebar is used** (adaptation §2).

## Stack (already scaffolded at the repo root)
Next.js 16.4.2 App Router, TypeScript, Tailwind v4, `src/` directory. **Package manager is npm** (node_modules was cloned from a local project because the network is slow, about 220 KB/s). The runtime deps listed below are being installed by the orchestrator right now. Don't run installs yourself unless a package is still missing once you need it; if you must, use `npm install --prefer-offline --no-audit --no-fund <pkg>`.

Add these dependencies:
- **Runtime:** `motion`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@radix-ui/react-tooltip`, `@tanstack/react-table`, `lucide-react`, `clsx`, `tailwind-merge`, `cmdk`
- **Dev:** `agentation`

## 1. Theme: `src/app/globals.css`
- Use design-system §8, **dark only**: put the dark token values directly in `:root` with no light/dark media query, and set `<html className="dark">`. Add `@custom-variant dark (&:where(.dark, .dark *));`.
- Add the Kitchen colour scale as Tailwind theme colours (`--color-grayscale-1` … `12`, using Radix gray **dark** values): `#111111 #191919 #222222 #2a2a2a #313131 #3a3a3a #484848 #606060 #6e6e6e #7b7b7b #b4b4b4 #eeeeee`.
- Add these Radix dark colours too:
  - green-9 `#30a46c`
  - red-3 `#3b1219`, red-4 `#500f1c`, red-8 `#b54548`, red-9 `#e5484d`, red-10 `#ec5d5e`, red-11 `#ff9592`
- Load Inter through `next/font` as `--font-inter`.
- Keep comments outside `@theme` blocks (see the gotcha in design-system §6).

## 2. Helpers
- `src/helpers/classname-helper.ts`: `export function cn(...inputs: ClassValue[])` built from clsx + tailwind-merge. The Kitchen files import from this exact path.
- `src/lib/ui.ts`: every recipe from design-system §4, plus:
  - `statusDot` (adaptation §3)
  - `tableWrap`, `th`, `td`, `tr` (adaptation §4)
  - `iconTile` (success and danger variants)
- `src/lib/format.ts`:
  - `formatMoney(minor: number)` → `₹2,41,800` (en-IN grouping, no decimals when the value is whole, otherwise 2 decimals)
  - `formatDate(d)` → "Today, Oct 31" or "Sat, Oct 18" (design-system §7)
  - `formatPeriod(a, b)`
  - Use a fixed `TODAY = new Date("2026-10-31T10:00:00+05:30")` exported from `src/lib/mock/clock.ts`, so the output is deterministic and never causes a hydration mismatch.

## 3. Kitchen components
Move `vendor/kitchen/*.tsx` and `IridescentFoil.module.css` into `src/components/kitchen/`, and `vendor/kitchen/textures/*` into `public/textures/`. Then delete `vendor/`. Make every component compile under strict TypeScript and lint without changing how it looks. They use `dark:` variants, which now resolve through the `.dark` class.

## 4. Mock domain: `src/lib/mock/`
- **`types.ts`:** types that mirror the planned data model:
  - `Role` = admin | staff | customer
  - `User`, `Customer`, `Product` (type, salesPrice, costPrice, notes, variants: {attribute, value, extraPrice}[])
  - `Tax` (name, rate %), `Plan` (price, interval daily|weekly|monthly|yearly, minQty, startDate, endDate, autoClose, closable, pausable, renewable)
  - `QuotationTemplate` (validityDays, planId, lines)
  - `Subscription` (number "SUB-0001", customerId, planId, status draft|quotation|confirmed|active|paused|closed, startDate, expiryDate, paymentTerms, nextBillingDate, lines)
  - `SubscriptionLine`, `Discount` (fixed|percent, value, minPurchase, minQty, start, end, usageLimit, timesUsed, scope products|subscription, targetIds)
  - `Invoice` (number "INV-0001", subscriptionId, customerId, status draft|confirmed|paid|cancelled, periodStart, periodEnd, issueDate, dueDate, lines, subtotal, discountTotal, taxTotal, total, amountPaid)
  - `Payment` (invoiceId, method upi|card|bank_transfer|cash, amount, date, note)
  - `ActivityEvent`
  - All money is integer paise.
- **`data.ts`:** a deterministic generator using a seeded PRNG (e.g. mulberry32), with no `Math.random`. It produces:
  - ~40 Indian SMB customers, 8 products (at least one with Brand variants, e.g. "Odoo" +₹560), 4 taxes (GST 18%, GST 12%, GST 5%, Exempt), 6 plans across the intervals, 3 templates, and 4 discounts (one expired, one used up)
  - ~150 subscriptions across all statuses
  - ~400 invoices over the last 6 months, with a realistic mix of paid, partly paid and overdue
  - payments and activity events
  - 14 subscriptions due to bill on TODAY
- **`selectors.ts`:** pure functions the screens call, e.g. `listSubscriptions(filter)`, `getSubscription(id)`, `invoiceBalance(inv)`, `isOverdue(inv)`, `dashboardKpis()`, `revenueByMonth()`, `overdueAgeing()`, `dueForBilling()`, `customerPortalData(customerId)`.
- **`pricing.ts`:** pure `priceLines(lines, taxes, discounts) → {subtotal, discountTotal, taxTotal, total}`. The real build reuses this, so give it a small Vitest test file (vitest and the script are already set up).

## 5. Shared UI: `src/components/ui/`
These components are built only from the recipes:
- `StatusDot`: maps status to dot colour and label, per adaptation §3
- `Intro`: icon tile + title + muted subtitle; temporary/persistent variants; `rise`/`pop` motion
- `PageGrid`: left sticky column + content, per the screen layouts in adaptation §5
- `DataTable`: generic TanStack table with sorting, client pagination (50 rows per page), row-click href, a selection checkbox column and a bulk bar slot, an empty state, and the footer "1–50 of N"
- `StatTile`: value counts up on load
- `Stepper`: status stepper, adaptation §5
- `Timeline`
- `Menu`: Radix DropdownMenu styled as raised, with `menu-in`
- `Dialog`: Radix Dialog inside a hero frame, with blurred backdrop and `fade-in`
- `Toaster` + `toast()`: bottom-centre; an Undo variant uses Kitchen's `UndoNotice`
- `Field`: label, control and hint
- `SavedViews`: settings-style raised menu of filter links

## 6. App shell
Route groups:
- `src/app/(app)/layout.tsx`: persistent sidebar + top bar
- `src/app/(auth)/`
- `src/app/(portal)/`

**Sidebar** (raised `rounded-2xl p-1`, adaptation §2): Dashboard · Subscriptions (chip: due today) · Billing run · Invoices (chip: overdue) · Payments · Customers, then the label "Catalog", then Products · Plans · Templates · Taxes · Discounts. Settings sits at the bottom. The active row uses the **selected** recipe. The sidebar collapses to icons below `lg`. Use hand-drawn filled SVG icons (Phosphor isn't installed; lucide is used elsewhere).

**Top bar:**
- BRIGHTLOOP wordmark pill with a workspace menu (Billing ✓, Customer portal)
- a ⌘K button that opens a `cmdk` palette for jumping to any page, subscription or customer
- the account button, with a menu containing: a demo **role switcher** (Admin/Staff, kept in React context; staff can't see Catalog or Settings), Settings, and Sign out (links to /login)

**Agentation:** add `src/components/dev/agentation-toolbar.tsx` (client), which renders `<Agentation />` from `agentation` **only when `process.env.NODE_ENV === "development"`**, with no endpoint prop. Mount it in the root layout.

## 7. Routes
Create every route below. Build **Dashboard fully** (adaptation §7) as the reference screen. Every other route gets a placeholder page using `PageGrid` + `Intro` ("Coming next"), so the nav works.

- `(app)`: `/` redirects to `/dashboard` · `/dashboard` · `/subscriptions` · `/subscriptions/new` · `/subscriptions/[id]` · `/billing` · `/invoices` · `/invoices/[id]` · `/payments` · `/customers` · `/customers/[id]` · `/catalog/products` · `/catalog/plans` · `/catalog/templates` · `/catalog/taxes` · `/catalog/discounts` · `/settings` (users & staff)
- `(auth)`: `/login` · `/signup` · `/reset`
- `(portal)`: `/portal` · `/portal/invoices` · `/portal/subscriptions/[id]`

## Done when
- `npm run typecheck` , `npm run lint`, `npm test` and `npm run build` all pass.
- `npm run dev` serves every route with no console errors or hydration warnings.
- The Dashboard matches the design docs.
- Don't commit. Report the files you created and anything you changed from this spec.
