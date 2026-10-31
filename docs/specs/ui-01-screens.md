# UI-01 Screens spec (four parallel lanes)

Read these first: `docs/design-system.md`, `docs/design-adaptation.md` (it wins where the two disagree), `docs/specs/ui-00-foundation.md`, and the foundation code that's already built (`src/lib/ui.ts`, `src/components/ui/*`, `src/components/kitchen/*`, `src/lib/mock/*`, the Dashboard page). Match the Dashboard's look and code style exactly.

## Rules for every lane
- Packages: `@phosphor-icons/react`, `recharts` and `react-parallax-tilt` are **not** installed (slow network). Use `lucide-react` icons, hand-written SVG charts and no tilt. Don't install anything new. **No single command may run longer than 5 minutes.**
- Use **mock data only**, through selectors. **Never edit shared files** (`src/lib/ui.ts`, `src/components/ui/*`, `src/lib/mock/{types,data,selectors,pricing}.ts`, the layouts, `globals.css`).
  - If you need a new selector, put it in `src/lib/mock/selectors-<lane>.ts`.
  - If you need a new component, put it in `src/components/<lane>/`.
  - If a shared file truly blocks you, stop and say so in your report.
- Mutations are local React state only, e.g. confirming an invoice updates the state on the page and shows a toast. Reversible actions get an Undo toast. Destructive ones use Kitchen `HoldToConfirmButton` or a confirm dialog.
- Every list uses `DataTable` with saved views on the left (`PageGrid` + `Intro` + `SavedViews`).
- Every record page has: the left column with facts and the single white next-action button, a `Stepper` where the record has states, the lines table, totals and a `Timeline`.
- Use Kitchen components only where they're listed below. Restyle them to fit the dark tokens if needed, inside your lane's copy or wrapper.
- When finished, run `npm run typecheck && npm run lint && npm run build`. Don't commit. Report the files you touched.

## Lane B: Subscriptions and Customers
Files: `src/app/(app)/subscriptions/**`, `src/app/(app)/customers/**`, `src/components/subscriptions/**`, `src/components/customers/**`, `src/lib/mock/selectors-subscriptions.ts`
- **`/subscriptions`:** saved views (All, Active, Quotations, Paused, Closing this month, Due today). Columns: Number, Customer, Plan, Status, Next billing, MRR, Start. The bulk bar offers Send quotation / Confirm.
- **`/subscriptions/[id]`:** the stepper covers Draft → Quotation → Confirmed → Active → Closed, with the Paused side state. The next action is the white button, which moves the state locally. Pause/Resume/Close appear only if the plan allows them. Show lines (product, variant, qty, unit price, taxes, amount), totals from `priceLines`, linked invoices (mini table) and the timeline. Use `ScrambleText` to reveal the SUB number.
- **`/subscriptions/new`:** a "Start from template" picker (template cards). The form has customer, plan, start, expiry (computed from the plan) and payment terms, plus an inline lines editor (add/remove rows, product + variant select, qty ≥ plan min qty). A **live totals** block sits under the lines. Save as Draft (secondary) / Send quotation (white, `DynamicButton` Saving… → Sent).
- **`/customers`:** columns Name, Email, Active subs, Outstanding, Overdue badge.
- **`/customers/[id]`:** facts, subscriptions, invoices, payments.

## Lane C: Billing run, Invoices and Payments
Files: `src/app/(app)/billing/**`, `src/app/(app)/invoices/**`, `src/app/(app)/payments/**`, `src/components/billing/**`, `src/lib/mock/selectors-billing.ts`
- **`/billing`:** the signature screen, built exactly as adaptation §6 describes.
  - Left column: an intro with the count and total, **Confirm all** (white) and "Review one by one".
  - Centre: a stacked hero deck of draft invoice previews (`dueForBilling()`). Approve flies the card right, ✕ (skip) flies it left with an Undo toast, and Edit opens a dialog.
  - Right column: the subscription context, with no card around it.
  - When the deck is empty, show the "You're all caught up!" state.
  - Use `ScrambleText` on the running total as it changes.
- **`/invoices`:** saved views (All, Draft, Confirmed, Paid, Overdue, Cancelled). Columns: Number, Customer, Issued, Due, Status (overdue is derived), Total, Balance. Bulk actions: Confirm / Send.
- **`/invoices/[id]`:**
  - Actions: Confirm / Send / Print / Cancel (`HoldToConfirmButton`).
  - The invoice is shown as an on-screen document preview inside a hero frame, with lines, discount, tax and total.
  - When the invoice is paid, a Kitchen `Stamp` reading "PAID" sits on the preview.
  - A payments list, a **Record payment** dialog (method/amount/date/note, amount defaulting to the balance), and the timeline.
  - The Print button opens `/invoices/[id]/print`, a light-theme A4 printable page (adaptation §9).
- **`/payments`:** columns Date, Invoice, Customer, Method, Amount, Note. Left column: totals by method.

## Lane D: Catalog and Settings
Files: `src/app/(app)/catalog/**`, `src/app/(app)/settings/**`, `src/components/catalog/**`, `src/lib/mock/selectors-catalog.ts`
- **Catalog layout:** a persistent left catalog menu (Products, Plans, Templates, Taxes, Discounts), built like the settings menu so it doesn't remount. Put it in `src/app/(app)/catalog/layout.tsx`.
- **Products:** a table, plus a product form in a dialog (name, type, sales price, cost price, notes) with a **variants editor** (attribute, value, extra price, e.g. Brand: Odoo +₹560).
- **Plans:** shown as `Ticket` cards (price, interval, min qty, availability dates, flag chips for auto-close / closable / pausable / renewable). The yearly plan card gets the `IridescentFoil` treatment. There's a plan form dialog with the flag checkboxes.
- **Templates:** a table plus a form (name, validity days, plan, product lines).
- **Taxes:** a list with an inline add form (name + rate).
- **Discounts:** a table showing type, value, minimums, dates, a usage bar (timesUsed/usageLimit) and a status (active / expired / used up). The form dialog is marked admin-only.
- **`/settings`:** users & staff. A team list with role, plus an "Add staff" dialog that only admins see. Use the role from context.
- Delete actions use `HoldToConfirmButton`.

## Lane E: Auth and Customer portal
Files: `src/app/(auth)/**`, `src/app/(portal)/**`, `src/components/auth/**`, `src/components/portal/**`, `src/lib/mock/selectors-portal.ts`
- **`/login`, `/signup`, `/reset`:** centred. The wordmark sits above a hero frame. Signup shows a **live password checklist**: more than 8 characters, uppercase, lowercase, special character. Show "email already registered" when the address is in the mock users. Reset shows a "Check your inbox" state. Use `LogoTraceLoader` while a submit is in flight (fake 800ms delay). Login takes you to `/dashboard`, or to `/portal` for a customer email.
- **Portal layout:** a simpler shell with no sidebar. The top bar has the wordmark, a pill nav (Subscriptions · Invoices · Account) and the account button. The mock customer is a fixed customer id.
- **`/portal`:** the customer's subscriptions shown as hero/Ticket cards (plan, next billing date, amount, status). Pause/Cancel appear only when the plan allows them. If a quotation is waiting, show an "Accept quotation" card with the Kitchen `Signature` drawing in on accept.
- **`/portal/invoices`:** a table. **Pay** (white) opens a dialog with the Kitchen `ReceiptPrinter` (processing → printing → complete), and the invoice then shows Paid.
- **`/portal/subscriptions/[id]`:** details, lines, and the invoice history.
