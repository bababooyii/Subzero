# Brightloop: team plan and status board

Hackathon: Sat 31 Oct 2026, 09:00–17:00 IST. Plan written 11:30. **Code freeze 16:00 · demo prep 16:15 · end 17:00.**
Brief: Subscription Management System for "Brightloop Software" (Odoo hackathon PDF). Design: `docs/design-system.md` + `docs/design-adaptation.md` (the adaptation wins).

> **Status: DRAFT, waiting for Labeeb's OK.** Nothing has been created on GitHub yet. Open questions are in §10.

### Organizer rules (announcements, 09:42 and 10:01)
- One repository for the team, under the lead's account. No GitHub organization and no extra repos.
- Add **`hackathon-odoo`** and **`sbbh-odoo`** as collaborators (team lead only). Submit the repo link on the hackathon portal.
- **Every team member pushes at least once every hour, and the latest code is always on `main`.** So every lane gets something **merged into `main` every hour**, not just pushed to a branch (§3, §4).
- Lead to-dos that only Labeeb can do: select the problem statement on the portal and submit the repo link.

---

## 0. Live status board

| # | Branch | Lane | State | PR | Target merge |
|---|---|---|---|---|---|
| 01 | `feat/01-bootstrap` | Labeeb | not started | – | 12:00 |
| 02 | `feat/02-foundation` | Labeeb | not started | – | 12:40 |
| 03 | `feat/03-ui-shell` | Labeeb (UI chat) | in progress (UI chat) | – | 13:00 |
| 04 | `feat/04-state-machine` | Yasin | not started | – | 12:50 |
| 05 | `feat/05-catalog-core` | Vishnu | not started | – | 13:30 |
| 06 | `feat/06-seed` | Don | not started | – | 13:40 |
| 07 | `feat/07-pricing` | Labeeb | not started | – | 13:30 |
| 08 | `feat/08-subscriptions` | Yasin | not started | – | 14:40 |
| 09 | `feat/09-catalog-ui` | Vishnu | not started | – | 14:30 |
| 10 | `feat/10-dashboard` | Don | not started | – | 14:40 |
| 11 | `feat/11-billing-engine` | Labeeb | not started | – | 14:45 |
| 12 | `feat/12-templates-customers` | Vishnu | not started | – | 15:30 |
| 13 | `feat/13-discounts-payments` | Yasin | not started | – | 15:40 |
| 14 | `feat/14-portal-print` | Don | not started | – | 15:40 |
| 15 | `feat/15-billing-run-invoices` | Labeeb | not started | – | 15:45 |
| 16 | `feat/16-perf-e2e` | Don | not started | – | 16:00 |

Hourly log (organizers' rule: everyone pushes every hour and `main` holds the latest code). Tick when that person's PR for the hour is **merged into `main`**.

| Dev | ≤12:50 | ≤13:50 | ≤14:50 | ≤15:50 | ≤16:50 |
|---|---|---|---|---|---|
| Labeeb | ☐ | ☐ | ☐ | ☐ | ☐ |
| Vishnu | ☐ | ☐ | ☐ | ☐ | ☐ |
| Yasin | ☐ | ☐ | ☐ | ☐ | ☐ |
| Don | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## 1. Architecture in one page

**Stack:** Next.js 16 (App Router, server actions, RSC) + TypeScript · PostgreSQL 16 in Docker + Drizzle ORM · Better Auth (email + password, Drizzle adapter, `role` column) · Mailpit in Docker for reset emails · Tailwind v4 + Radix primitives styled with the design recipes · TanStack Table (server-side paging) · Recharts · Zod · Vitest (unit + DB integration) · Playwright (smoke + perf). pnpm. No BaaS.

**Request flow:** page (RSC) → `src/features/<domain>/queries.ts` (reads) / `actions.ts` (server actions, Zod-validated, `requireRole()` first) → `src/server/*` domain modules → Drizzle → Postgres. Every status change: `actions.ts` → `src/server/state-machine` → writes the row **and** an `activity_log` entry in the same transaction.

**Billing flow:**
```
billing run (date D)
  └─ select active subscriptions with next_invoice_date ≤ D           (index on status, next_invoice_date)
       └─ for each: price(lines, taxes, discounts, D)   ← pure function, src/server/pricing
            └─ tx: INSERT invoice + invoice_lines (snapshot of names, prices, tax rates)
                   ON CONFLICT (subscription_id, period_start) DO NOTHING   ← idempotency
                   INSERT discount_redemptions (unique per discount+invoice), bump used_count
                   advance subscription.next_invoice_date; activity_log
```
Invoices: Draft → Confirmed → Paid (+ Cancelled). "Overdue" and "Partially paid" are derived (confirmed, due_date < today / payments < total), not stored states.

**Engineering rules (non-negotiable, checked in review):**
1. One invoice per (subscription, period): `UNIQUE (subscription_id, period_start)`. A test runs billing twice and asserts the count is unchanged.
2. Every status change goes through `src/server/state-machine`. No `update(...).set({ status })` anywhere else (a lint grep in CI enforces this).
3. Prices, taxes and discounts come from one pure function, `src/server/pricing/price.ts`, with unit tests.
4. Money is `integer` minor units (paise) everywhere. Tax rates are basis points. Format only at the edge with `src/lib/money.ts` (₹, Indian grouping).
5. Invoice lines snapshot product name, variant, unit price, qty and tax rate when created. They never join back to the catalog for amounts.
6. `activity_log` records every state change (entity, from, to, actor, at, meta).

### Data model v1 (lands in `feat/02-foundation`)

| Table | Key columns | Owner |
|---|---|---|
| `user`, `session`, `account`, `verification` | Better Auth tables; `user.email` unique, `user.role` enum `admin\|staff\|customer` | Labeeb |
| `customers` | id, user_id (nullable, unique), name, email, company, phone, address | Vishnu |
| `products` | id, name, type enum `service\|goods`, sales_price, cost_price, notes, active | Vishnu |
| `product_variants` | id, product_id, attribute (e.g. "Brand"), value ("Odoo"), extra_price (56000 = +₹560) | Vishnu |
| `plans` | id, name, price, interval enum `day\|week\|month\|year`, interval_count, min_qty, available_from, available_to, auto_close, can_close_early, can_pause, can_renew | Vishnu |
| `taxes` | id, name, rate_bps, active | Vishnu |
| `product_taxes` | product_id, tax_id | Vishnu |
| `payment_terms` | id, name, due_days | Vishnu |
| `quotation_templates`, `quotation_template_lines` | name, validity_days, plan_id, payment_term_id; lines: product_id, variant_id, qty | Vishnu |
| `subscriptions` | id, number unique (`SUB-0001` from a sequence), customer_id, plan_id, status enum `draft\|quotation\|confirmed\|active\|paused\|closed`, start_date, expiry_date, next_invoice_date, payment_term_id, quotation_valid_until, template_id | Yasin |
| `subscription_lines` | subscription_id, product_id, variant_id, qty, unit_price | Yasin |
| `discounts`, `discount_products` | name, kind `fixed\|percent`, value, scope `product\|subscription`, min_amount, min_qty, starts_on, ends_on, usage_limit, used_count | Yasin |
| `discount_redemptions` | discount_id, invoice_id, amount; `UNIQUE(discount_id, invoice_id)` | Yasin |
| `payments` | id, invoice_id, method enum `cash\|bank_transfer\|card\|upi\|cheque`, amount, paid_on, note, recorded_by | Yasin |
| `activity_log` | id, entity_type, entity_id, action, from_status, to_status, actor_id, at, meta jsonb | Yasin |
| `invoices` | id, number unique (`INV-0001`), subscription_id, customer snapshot jsonb, period_start, period_end, status `draft\|confirmed\|paid\|cancelled`, issued_on, due_date, subtotal, discount_total, tax_total, total, amount_paid, sent_at; `UNIQUE(subscription_id, period_start)` | Labeeb |
| `invoice_lines` | invoice_id, description, product_id, variant_label, qty, unit_price, tax_rate_bps, discount, line_total (all snapshots) | Labeeb |
| `billing_runs` | id, run_date, created_count, skipped_count, started_by | Labeeb |

Dashboard indexes (Don proposes, table owner approves): `subscriptions(status)`, `subscriptions(status, next_invoice_date)`, `invoices(status, due_date)`, `invoices(issued_on)`, `payments(paid_on)`, `invoices(subscription_id)`, `subscription_lines(subscription_id)`.

### Module layout and ownership

```
src/
  app/
    layout.tsx, globals.css                  UI lane (Labeeb, UI chat)
    (auth)/sign-in, sign-up, reset/**        Labeeb
    (app)/layout.tsx                         UI lane  — shell, sidebar/top bar, nav entries for ALL sections pre-created
    (app)/dashboard/**                       Don
    (app)/subscriptions/**                   Yasin
    (app)/invoices/**                        Labeeb
    (app)/billing-run/**                     Labeeb
    (app)/payments/**                        Yasin
    (app)/customers/**                       Vishnu
    (app)/catalog/layout.tsx + menu          Vishnu  (menu lists Discounts too; the route is Yasin's)
    (app)/catalog/{products,plans,taxes,payment-terms,templates}/**   Vishnu
    (app)/catalog/discounts/**               Yasin
    (app)/settings/users/**                  Labeeb  (admin adds staff)
    (portal)/portal/**                       Don
    (print)/invoices/[id]/print/**           Don
  components/ui/**, components/shell/**      UI lane
  components/kitchen/**                      UI lane  (vendor/kitchen adapted to our tokens)
  lib/ui.ts (recipes), lib/cn.ts             UI lane
  lib/money.ts, lib/dates.ts                 Labeeb
  lib/auth/** (Better Auth config, requireRole, session helpers)   Labeeb
  db/client.ts, db/schema/index.ts, db/schema/auth.ts, drizzle/** (migrations)   Labeeb
  db/schema/catalog.ts                       Vishnu
  db/schema/subscriptions.ts, discounts.ts, payments.ts, activity.ts   Yasin
  db/schema/invoices.ts                      Labeeb
  db/seed/**                                 Don
  features/<domain>/{queries,actions,schemas}.ts   owner of that domain
  server/state-machine/**, server/activity-log.ts  Yasin
  server/pricing/**                          Labeeb
  server/billing/**                          Labeeb
  server/mail.ts                             Labeeb
tests/e2e/<lane>.spec.ts                     each lane its own file
.github/**, package.json scripts, docker-compose.yml, drizzle.config.ts   Labeeb
```

---

## 2. Lanes

| Lane | Owner | Scope |
|---|---|---|
| **A: Platform & billing** | Labeeb | Bootstrap, schema v1, auth & roles (sign-up rules, reset via Mailpit, admin adds staff), money/date libs, pricing function, billing engine, invoices list/record/actions, billing-run screen, migrations, PR review & integration. Also drives the UI chat (shell, recipes, components). |
| **B: Catalog & customers** | Vishnu | Products + variants, plans (+ flags), taxes, payment terms, quotation templates, customers list/record, catalog menu. |
| **C: Lifecycle & money in** | Yasin | State machine (subscription + invoice transitions) + activity log, subscriptions list/record/editor (from template, live totals via pricing), discounts (admin-only), payments (record, outstanding/paid views). |
| **D: Finance & customer** | Don | Seed (5k+ subscriptions, ~50k invoices, payments), dashboard (KPIs, revenue chart, ageing, overdue table), customer portal, invoice print/PDF, perf budget + Playwright perf/smoke. |

Changes from the starting proposal: customers and payment terms moved to Vishnu (catalog was the lightest lane); the **state machine and activity log** moved to Yasin so lane C starts with a pure, testable module while the foundation lands, and Labeeb's billing engine consumes it.

---

## 3. Branching, merging and shared files

- `main` changes only through PRs that are **reviewed by someone other than the author** and have green CI. Labeeb reviews everyone's PRs; Labeeb's own PRs are reviewed by Vishnu (backup: Yasin). If Labeeb is backed up during a merge window, any other teammate may review.
- **Hourly merge cadence (organizer rule).** Every lane opens a PR by **:30** each hour with whatever is finished and tested, and it merges by **:50**. Branches that span several hours land in slices: after a slice merges, rebase the same branch on `main` and keep going, then open the next PR from it next hour.
- **Staggered pushes (team decision, 11:56).** Never two pushes within 5 minutes of each other; aim for 5–10 minutes apart. Push slots each hour: **Yasin :05 · Vishnu :12 · Don :19 · Labeeb :26**, so all PRs are open by :30; merges happen :35–:55. Extra pushes are fine at any time as long as the 5-minute gap holds. Every push goes through the hub's push helper, which refuses a push that comes too soon and logs who pushed what and when.
- **Unfinished work must not break `main`.** It must build and pass tests. A page that isn't ready isn't linked from the nav yet (the shell reads a `ready` flag per nav entry in `components/shell/nav.ts`; the owner flips their own entry via the UI lane). Server code can land before its UI.
- Branches: `feat/<nn>-<name>` (numbers in §0). Conventional commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`). Small commits, pushed as you go.
- **Rebase, don't merge:** `git fetch && git rebase origin/main` before opening a PR and before merging. PRs land with **rebase-merge** (not squash), so each person's individual commits stay on `main` under their own name and the organizers can see who did what.
- **File ownership is the conflict strategy.** You edit only files your lane owns (§1). Need a change in someone else's file? Ask in chat; the owner makes it, or you include it in your PR with the owner as reviewer.
- **Shared files:**
  - `db/schema/*`: each domain file has an owner. **Migrations are generated only by the PR author, last, right before merge**, after rebasing on the latest `main` (`pnpm db:generate`). Only one migration-carrying PR merges at a time; say "taking the migration token" in chat. CI fails if `drizzle-kit generate` produces a diff (schema and migrations out of sync).
  - Migration order: `0000` foundation (all v1 tables) → `0001` subscriptions/discounts tweaks (08) → `0002` billing tweaks (11) → `0003` payments tweaks (13) → `0004` dashboard indexes (16). Most lanes should need **no** migration after v1, because v1 contains every table.
  - `app/(app)/layout.tsx`, `components/shell/**`, `lib/ui.ts`, `globals.css`: UI lane only. The shell PR pre-creates nav entries for every section, so lanes never touch it.
  - `package.json` / `pnpm-lock.yaml`: bootstrap installs every dependency we know we need. If you add one later, never hand-merge the lockfile: rebase, take `main`'s lockfile, re-run `pnpm add`.
- **Coordination with the UI chat:** it works on `feat/03-ui-shell` and owns the shell, recipes and `components/ui`. Lanes build pages with those components once 03 merges (~13:00). Before that, lanes do server code (queries, actions, tests), which is most of the work anyway.

---

## 4. Hour-by-hour schedule

Every hour: **PR open by :30, merged into `main` by :50**, for every lane (organizer rule). The "PR / merge" column shows the planned slice; when a branch isn't finished, its finished part still merges that hour. ✂ = cut-first candidate (§5).

### 11:30–12:30
| Dev | Branch | Commit-sized tasks | PR / merge |
|---|---|---|---|
| Labeeb | `main` init → `feat/01-bootstrap` → `feat/02-foundation` | 1) repo with README/.gitignore, protection on. 2) bootstrap: Next app at repo root, all deps, scripts (`typecheck lint test build db:*`), `docker-compose.yml` (postgres 16 + Mailpit), `drizzle.config.ts`, Vitest config, `ci.yml`, PR template. 3) foundation: schema v1 (every table in §1) + migration 0000. 4) `lib/money.ts`, `lib/dates.ts` + tests. 5) Better Auth config, `requireRole()` | 01 PR 11:50, merge 12:00 (Vishnu reviews). 02 PR 12:25 |
| Vishnu | `feat/05-catalog-core` | setup (clone/worktree, `pnpm i`, `docker compose up`); review 01; Zod schemas for product, variant, plan, tax, payment term, template + tests | push 12:25 |
| Yasin | `feat/04-state-machine` | setup; `server/state-machine`: transition tables for subscription (draft→quotation→confirmed→active⇄paused→closed, plus plan flags) and invoice (draft→confirmed→paid, →cancelled); `canTransition`, `transition(tx, entity, to, actor)`; tests | push 12:25 |
| Don | `feat/06-seed` | setup; seed design: deterministic generator (seeded faker), volumes (5k subs, 300 customers, 20 products, 8 plans, ~50k invoices, ~40k payments), batch inserts of 1k rows; draft dashboard SQL (KPIs, revenue by month, ageing) as plain functions | push 12:25 |

### 12:30–13:30
| Dev | Branch | Tasks | PR / merge |
|---|---|---|---|
| Labeeb | `feat/02-foundation` → `feat/07-pricing` | merge 02 (12:40); sign-up/sign-in/reset server side (password rule: >8 chars, upper, lower, special; reset email to Mailpit); seed admin user. Pricing: `price({lines, taxes, discounts, on})` → line subtotals, discounts (fixed/percent, product/subscription scope, min amount/qty, date window, usage left), tax per line, totals, `appliedDiscountIds`; rounding half-up per line; 15+ unit tests | 07 PR 13:20, merge 13:30 |
| Vishnu | `feat/05-catalog-core` | rebase on 02; `features/catalog/{queries,actions}.ts`: products + variants CRUD, plans CRUD (flags, availability), taxes, payment terms; admin-only guards; integration tests | PR 13:20, merge 13:30 |
| Yasin | `feat/04-state-machine` → `feat/08-subscriptions` | 04 PR 12:40, merge 12:50. Then `features/subscriptions/actions.ts`: create draft, add/edit lines, create from template (copies lines, sets `quotation_valid_until`), number from sequence, each move via state machine; tests | push 13:25 |
| Don | `feat/06-seed` | seed against schema v1 via Drizzle; `pnpm db:seed` and `pnpm db:reset`; run it and record timing; dashboard queries file + tests on seeded data | PR 13:30, merge 13:40 |
| UI chat | `feat/03-ui-shell` | shell, `lib/ui.ts`, DataTable, StatusDot, Field, Dialog, Toast, kitchen components adapted | merge ~13:00 |

### 13:30–14:30
| Dev | Branch | Tasks | PR / merge |
|---|---|---|---|
| Labeeb | `feat/11-billing-engine` | `server/billing/run.ts`: due query, pricing, snapshot insert `ON CONFLICT DO NOTHING`, discount redemptions, advance `next_invoice_date`, auto-close plans past `expiry_date`; invoice actions confirm/cancel/send (Mailpit)/mark paid via state machine; DB integration test: run twice → same invoice count; review 05/06/08 | PR 14:35 |
| Vishnu | `feat/09-catalog-ui` | catalog layout + menu; products table + editor with variant rows (Odoo brand +₹560 demo); plans table + editor | PR 14:20, merge 14:30 |
| Yasin | `feat/08-subscriptions` | subscriptions list (server paging/sort/filter in URL, saved views), record page (stepper, lines, totals, activity timeline), editor with live totals from `price()` | PR 14:30, merge 14:40 |
| Don | `feat/10-dashboard` | KPI tiles (active subs, MRR, collected this month, outstanding, overdue), revenue chart, overdue ageing bars, overdue table top 8; filters (period, plan) in URL; time each query against the seed (<300 ms target) | PR 14:30, merge 14:40 |

### 14:30–15:30
| Dev | Branch | Tasks | PR / merge |
|---|---|---|---|
| Labeeb | `feat/15-billing-run-invoices` | merge 11 (14:45); billing-run screen (hero deck: approve / skip with undo / confirm all) ✂→table; invoices list (overdue chip) + record page (lines, totals, payments, timeline, Confirm/Send/Print/Cancel); admin "add staff" page | PR 15:35 |
| Vishnu | `feat/12-templates-customers` | taxes + payment terms screens; quotation templates (lines, validity days); customers list + record (their subscriptions, invoices, balance) | PR 15:20, merge 15:30 |
| Yasin | `feat/13-discounts-payments` | discounts CRUD (admin-only, product picker, usage counter); payments: record-payment dialog (defaults to balance due, undo toast), payments list, invoice paid/partially paid/outstanding derivation, "paid → state machine" | PR 15:30, merge 15:40 |
| Don | `feat/14-portal-print` | portal: own subscriptions as hero cards (pause/cancel when plan allows, via Yasin's actions), invoices table with Pay ✂(mock checkout); scoping test (customer A can't read B); invoice print view (light A4, `@media print`) | PR 15:30, merge 15:40 |

### 15:30–16:15 (integration, freeze at 16:00)
| Dev | Branch | Tasks | PR / merge |
|---|---|---|---|
| Labeeb | `feat/15-…`, then review | merge 15 (15:45); final review/merge of everything; `main` freeze 16:00; full manual pass of the demo path on a fresh `db:reset` | — |
| Vishnu | `fix/…` from bugs found | catalog bugs; seed demo-friendly catalog (Odoo brand variant, monthly/yearly plans, GST 18%) into Don's seed via PR to `db/seed` with Don as reviewer | merge by 16:00 |
| Yasin | `fix/…` | lifecycle edge cases (quotation expiry, pause/resume, close early, renew) + Playwright `tests/e2e/subscriptions.spec.ts` ✂ | merge by 16:00 |
| Don | `feat/16-perf-e2e` | indexes migration 0004; Playwright perf test: every main page < 2 s on 5k seed, numbers into README; smoke e2e | PR 15:50, merge 16:00 |

### 16:15–17:00 demo prep (no new features; fixes only, via fast PRs)
| Dev | Tasks |
|---|---|
| Labeeb | demo script (sign up → catalog → template → subscription → billing run → payment → dashboard → portal); drive the run-through; README (setup, architecture, rules). Push by 16:25. |
| Vishnu | demo data check for catalog/templates; screenshot set for README. Push by 16:25. |
| Yasin | rehearse lifecycle + payments part of the demo; fix-only PRs. Push by 16:25. |
| Don | `pnpm demo:reset` (reset + seed + demo accounts) tested twice; perf numbers slide; print an invoice to PDF. Push by 16:25. |

---

## 5. What gets cut first (in this order)

1. Extra Playwright e2e beyond one smoke test and the perf test.
2. Kitchen flourishes (Signature, IridescentFoil, MagneticDropZone, LogoTraceLoader).
3. Quotation queue reusing the hero deck.
4. Portal **Pay** mock checkout (keep the invoices table).
5. Billing-run hero deck → a plain table with **Confirm all**.
6. Invoice PDF → browser print only.
7. Customer record page → list only.

**Never cut:** idempotent billing + its test, pricing function + tests, state machine + activity log, role guards and portal scoping, dashboard < 2 s with the seed, sign-up password rules + reset email.

---

## 6. Per-developer setup

Recommended: **each person works on their own laptop**, with their own `gh auth login` and git identity. That makes attribution automatic.

```bash
git clone https://github.com/LabeebHameed/brightloop.git && cd brightloop
git config user.name "Vishnu KR"
git config user.email "186273563+vishnuu-kr@users.noreply.github.com"
gh auth setup-git          # pushes use your own gh login
pnpm i && docker compose up -d && pnpm db:migrate && pnpm db:seed
```

| Dev | `user.name` | `user.email` | gh login |
|---|---|---|---|
| Labeeb | Labeeb Hameed | 182422045+LabeebHameed@users.noreply.github.com | LabeebHameed |
| Vishnu | Vishnu KR | 186273563+vishnuu-kr@users.noreply.github.com | vishnuu-kr |
| Yasin | Mohammed Yasin | 198542287+bababooyii@users.noreply.github.com | bababooyii |
| Don | Don Savio | 111143665+Rickasslee@users.noreply.github.com | Rickasslee |

If someone has to work on **this shared machine**, use one worktree per person with worktree-local identity and credentials, so nobody runs the global `gh auth switch` while someone else is pushing:

```bash
git config extensions.worktreeConfig true
git worktree add ../bl-vishnu feat/05-catalog-core
cd ../bl-vishnu
git config --worktree user.name "Vishnu KR"
git config --worktree user.email "186273563+vishnuu-kr@users.noreply.github.com"
git config --worktree credential.helper ""
git config --worktree --add credential.helper '!f() { echo username=vishnuu-kr; echo "password=$(gh auth token -u vishnuu-kr)"; }; f'
```

Each worktree needs its own `.env` (different `PORT`, same Postgres, or a separate database name per person).

**Attribution rule:** every commit is authored by, and pushed from, the account of the person who did that work. Nobody pushes under a teammate's account to cover for them. If someone is away, their lane waits or is reassigned openly here on the board (new owner, new branch, their own commits).

---

## 7. Repo setup (after OK)

- Repo `LabeebHameed/brightloop` (name to confirm), visibility per §10. Collaborators: `vishnuu-kr`, `bababooyii`, `Rickasslee` (team), plus **`hackathon-odoo`** and **`sbbh-odoo`** (organizers). On a personal-account repo every collaborator gets write access; there is no read-only role.
- Labeeb then submits the repo link on the hackathon portal.
- Initial commit: README + `.gitignore` only. Everything else arrives through `feat/01-bootstrap`.
- `main` protection: PR required, 1 approving review, required status check `ci`, branch up to date before merge, no force-push, no deletion, linear history, applies to admins too.
- `.github/workflows/ci.yml` on every push and PR: pnpm install (cached) → `typecheck` → `lint` (+ the "no status writes outside the state machine" grep) → `drizzle-kit generate` drift check → `test` (Vitest with a `postgres:16` service container, migrations applied) → `build`.
- `.github/pull_request_template.md`: Summary · Workflow · Commits · UI changes · Architecture changes · How it was verified · Follow-ups / known gaps.
- Preview deployments: none. The stack is local Postgres in Docker and a hosted DB would add a BaaS/hosting dependency; UI is verified locally in the browser instead.

## 8. How each phase runs from the hub

For Labeeb's lane, the hub writes a spec (files, interfaces, tests, done criteria), hands it to an implementer subagent (mechanical work to grunt), reviews the full diff, runs typecheck/lint/tests/build and checks the UI in the browser, then commits as Labeeb, pushes, waits for green CI and opens the PR with the full template.

For the other lanes, the hub writes the same spec into `docs/specs/<nn>-<name>.md` for that teammate. **The teammate runs it** (their own Claude session or by hand), commits and pushes from their own account; the hub reviews the PR and updates the board.

## 9. Definition of done for every PR

Spec's done criteria met · typecheck, lint, tests, build green locally and in CI · new logic has tests · UI checked in the browser against the design docs · PR template filled in, screenshots for UI · board in §0 updated.

## 10. Open questions for Labeeb

1. **Repo visibility:** public or private? The organizers asking to be added as collaborators suggests private is allowed. But a free personal account can't enforce branch protection on a private repo, so private would mean protection by convention only, or upgrading.
6. **Review load:** with four PRs merging every hour, Labeeb would review about three PRs an hour on top of lane A. OK for any teammate to review a PR when Labeeb is busy?
2. **App location:** the UI chat has scaffolded the Next.js app in `web/`, but the plan (and your brief) puts it at the repo root. Move it to the root in `feat/01-bootstrap` (tell the UI chat), or keep `web/`?
3. **Who drives the other three lanes?** Section 8 assumes each teammate drives their own lane. If instead this hub's subagents write Vishnu's, Yasin's and Don's code, committing it under their accounts would break the attribution rule. In that case it should be committed as Labeeb, and their hourly pushes must come from work they do themselves. Please confirm which, and whether the organizers accept AI-assisted lanes.
4. **Shared machine:** all four gh accounts are logged in here, and the currently active one is `Rickasslee` (Don), not `LabeebHameed`. Are teammates on their own laptops (recommended), or sharing this one (then the worktree setup in §6)? I'll switch to `LabeebHameed` before creating anything.
5. **Repo name:** `brightloop` OK?
