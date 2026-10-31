# Design adaptation: Brightloop billing app

[`design-system.md`](design-system.md) was written for a post-approval app (a card deck plus archive grids). Brightloop is a billing back office with tables, records, forms and a finance dashboard. This file says how each part of the system applies here and adds the few patterns it lacks. **Where this file and the design system disagree, this file wins.** Anything not mentioned here follows the design system unchanged.

## 1. What carries over unchanged

Tokens (§2), the class recipes (§4), global CSS (§8), motion (§6), the dropdown behaviour, checkboxes/selects/disclosures, toasts, and the Do/Don't list (§10). Dark theme only. The one exception is the invoice print view (§9 below).

UI primitives: Radix (Dialog, DropdownMenu, Popover, Tooltip) and TanStack Table, styled **only** with the recipes. Do not use shadcn's default theme: it brings its own colours, radii and borders.

## 2. App shell

- **A sidebar is allowed** and overrides design-system §3's "no sidebar" rule. When used, it's a raised `rounded-2xl p-1` column built like the settings menu (icon + label rows, **selected** recipe for the active row) holding the main sections. The top bar then keeps only the wordmark, search/⌘K and the account button.
- **Top bar** as specified. The wordmark pill reads `BRIGHTLOOP`. Its menu is a **workspace switcher**: "Billing" (admin/staff app, current ✓) and "Customer portal" (an admin can preview it as a chosen customer).
- **Pill nav (admin/staff):** Dashboard · Subscriptions · Invoices · Payments · Customers · Catalog.
  - Count chips carry meaning only: Subscriptions = due to bill today, Invoices = overdue. No chip when the count is 0.
  - Staff don't see Catalog.
- **Account button menu:** Settings (admin: Users & staff, Taxes, Payment terms, Company) · Billing run · Sign out.
- **Pill nav (portal):** Subscriptions · Invoices · Account.
- Filled nav icons: the four in design-system §9 are not enough. Draw filled 24×24 even-odd icons for dashboard (grid of tiles), subscriptions (circular arrows), invoices (receipt with cut-out lines), payments (card with cut-out stripe), customers (two heads) and catalog (box). Never use filled outline icons.

## 3. Status: the one place colour is allowed

The design system keeps everything grey, but billing states have to be readable at a glance. A status is a **6px dot plus a muted label**. Only the dot is coloured, and the label stays `--muted` (or `--text` on the record's own page).

| Status | Dot |
|---|---|
| Draft | `#6B6A66` |
| Quotation | `#9A9994` (ring, not filled) |
| Confirmed | `#ECECEA` |
| Active / Paid | `#34D399` |
| Paused | `#FBBF24` |
| Partially paid | `#FBBF24` |
| Overdue | `#F43F5E` |
| Closed / Cancelled | `#4A4A48` |

Recipe: `inline-flex items-center gap-1.5 text-[12px] text-muted` + a `size-1.5 rounded-full` dot. No filled pill badges.

## 4. Data tables (new pattern)

Most screens are tables, and the design system only has lists. Tables use:

- Container: `surface` (recessed, `rounded-2xl`, overflow hidden).
- Header row: 36px, `text-[12px] text-muted font-medium`, a hairline below, sticky.
- Body rows: 44px, 13px, `divide-y divide-white/[0.05]`, hover `bg-white/[0.03]`. The whole row is clickable and opens the record.
- Money and quantities: right-aligned, `tabular-nums`. Dates use the §7 format ("Today, Nov 1", "Sat, Oct 18").
- Row actions: `btnSquare` icons that appear on row hover/focus, at the right edge.
- Selection: checkbox column, then a **bulk bar** that rises in (`rise`) above the table: "3 selected · Send · Confirm". Confirm is the area's single white button.
- Footer: "1–50 of 4,812", plus prev/next `btnSquare`. Pagination, sorting and filtering happen on the server, with state kept in the URL.
- Empty state: the intro block centred inside the table area ("No overdue invoices" / "Everything is paid up.").

## 5. Layouts by screen type

| Screen | Left column (sticky, ≤280px) | Content |
|---|---|---|
| **List** (Subscriptions, Invoices, Payments, Customers) | Persistent intro (icon tile, title with live count, muted subtitle such as "₹4.2L outstanding"), then **saved views** as a settings-style raised menu (All, Active, Paused, Closing this month…), then a "New" primary button | Table, spanning both columns. The grid widens to `max-width 1440px` on list screens |
| **Record** (subscription, invoice, customer) | Number, status, key facts (customer, plan, dates, terms), then the record's actions (one white primary = the next state move) | **Status stepper**, line items table, totals block, **activity timeline** |
| **Form / editor** | Short explanation and hints | Form spanning both columns, max 760px. The subscription editor shows a live totals block (subtotal, discount, tax, total) under the lines |
| **Catalog** (Products, Plans, Templates, Taxes, Discounts) | Persistent catalog menu, like the Settings menu (same component; doesn't remount) | Table or form |
| **Billing run** | See §6 | Hero deck |
| **Dashboard** | Intro ("November so far") plus the period and plan filters | KPI tiles, charts, overdue list |

**Status stepper:** a raised `rounded-full p-1` bar with five segments (Draft → Quotation → Confirmed → Active → Closed). Past steps use `text-muted` with a ✓, the current step uses **selected**, and future steps are `text-muted/50`. A paused subscription shows "Paused" as an amber dot next to the stepper instead of a sixth segment.

**Activity timeline:** a list of events, each with a 12px muted time, a 13px sentence ("Invoice INV-0142 confirmed by Asha") and a hairline connector. New events `rise` in.

## 6. Billing run: the signature screen

This is where the hero deck earns its place, and it's the strongest demo moment.

- **Left (temporary intro, then persistent):** a success icon tile, "14 invoices ready for November", and a muted line "₹2,41,800 total · 3 discounts applied". Under it, a white **Confirm all** button and a secondary "Review one by one".
- **Centre (hero deck):** each card is a **draft invoice preview**. The header shows the customer name and SUB number. The body shows lines, discount, tax and total in tabular numbers, and the date label above reads "Billing period Nov 1 – Nov 30".
  - **Approve** (white, ✓) confirms the invoice, and the card flies right.
  - **✕** skips it for this run (it stays due), and the card flies left. Toast: "Skipped INV draft for Acme · Undo".
  - **Edit** opens the invoice in a side overlay.
- **Right (context, no card):** the subscription behind the invoice: plan, period, last payment, open balance, and an overdue warning if there is one.
- **Done state:** "You're all caught up!", followed by a link to the invoices just confirmed.

The quotation queue ("Quotations waiting for confirmation") reuses the same deck.

## 7. Dashboard

- **KPI row:** 5 recessed tiles (Active subscriptions, MRR, Collected this month, Outstanding, Overdue). Each has a 12px muted label and a 22px weight-500 tabular value. That's a deliberate exception to "nothing above 18px", since the values are content, not chrome. A 12px delta line sits underneath. Values count up on load.
- **Revenue chart:** one line or bar series in `#ECECEA` with 5% white grid lines, no legend for a single series, and a tooltip built from the **raised** recipe.
- **Overdue ageing:** three horizontal bars (0–30, 31–60, 60+ days). They are grey, except 60+ days, which uses `#F43F5E`.
- **Overdue invoices:** a compact table (top 8), with a "Record payment" row action.
- Accent blue is never used in charts.

## 8. Forms and dialogs

- Form fields follow the design system (32px, 8px label gap, 12px hints). Money inputs right-align their value.
- **Record payment:** a dialog with a hero-card frame (402px), the fields method/amount/date/note, the amount defaulting to the balance due, and **Record payment** as the white button.
- **Destructive actions** (cancel invoice, close subscription, delete product) ask for confirmation. **Reversible ones** (pause/resume, skip in billing run, record payment) use an Undo toast.

## 9. Auth, portal and print

- **Sign in, sign up and reset:** centred single column. The wordmark sits above a hero-card frame containing the form, with one white button. Password rules appear as a live checklist under the field (soft checkboxes turn on as each rule is met).
- **Customer portal:** same shell, with the portal pill nav. The Subscriptions page shows each subscription as a hero card: plan, next billing date, amount, and Pause/Cancel where the plan allows it. Invoices is a table with **Pay** (white) opening a mock checkout in the payment dialog.
- **Invoice print / PDF:** this is the only light surface. It uses the light tokens (`--bg #FFFFFF`, `--text #1C1C1A`, `--line #E6E5E1`), Inter, and an A4 layout with `@media print`. The on-screen invoice page shows a preview of it inside a hero frame.

## 10. Copy for this product

- Intros: "14 invoices ready for November", "3 invoices overdue · ₹48,200", "You're all caught up!", "Everything is paid up."
- Buttons are verbs for the next state: Send quotation, Confirm, Activate, Pause, Resume, Close, Confirm invoice, Record payment, Run billing.
- Numbers: SUB-0001 and INV-0001. Currency defaults to ₹ with Indian digit grouping and is a company setting.
