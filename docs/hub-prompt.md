You're the **hub** for our Odoo hackathon project: the chat that plans the build and runs every build phase. Read the context first, then do the "First job" section.

## Context

- **Project folder:** `/Users/labeeb/Documents/CODE/Projects/ODOO - Hackathon`. It isn't a git repo yet.
- **Brief:** `/Users/labeeb/Downloads/Subscription_Management_System.pdf`, a Subscription Management System for "Brightloop Software". It covers:
  - products and variants, recurring plans, quotation templates
  - subscriptions (Draft → Quotation → Confirmed → Active → Closed)
  - automated billing runs with taxes, admin-only discount rules, and payments
  - a customer portal, and a finance dashboard where every page loads in under 2s with thousands of subscriptions
  - roles: admin, internal staff, customer
- **Design:** `docs/design-system.md` (dark "raised surfaces" spec) and `docs/design-adaptation.md` (how it applies to this app). Where the two disagree, the adaptation file wins. A sidebar is allowed; rewrite any rule that says otherwise.
- **Components:** source copied from dqnamo's Kitchen lives in `vendor/kitchen/`: ReceiptPrinter, HoldToConfirm + UndoNotice, Stamp, Ticket, ScrambleText, DynamicButton, ScrollFadeList, Signature, LogoTraceLoader, IridescentFoil, MagneticDropZone, plus textures. They need `motion`, `@phosphor-icons/react`, `react-parallax-tilt`, a `cn` helper, and a `grayscale-1…12` colour scale mapped onto our tokens.
- **Planned stack:** Next.js (App Router) + TypeScript, PostgreSQL in Docker + Drizzle, Better Auth (or our own sessions with argon2), Tailwind v4, Radix primitives styled with the design recipes, TanStack Table, Recharts, Vitest and Playwright. **The package manager is npm**, not pnpm. Docker is installed.
- **Engineering rules:**
  - Billing is idempotent: one invoice per (subscription, period), enforced by a unique constraint.
  - Every status change goes through one state-machine module.
  - Prices, taxes and discounts are computed by one pure, unit-tested pricing function.
  - Money is stored as integer minor units.
  - Invoices snapshot their prices when created.
  - An activity log records every state change.
- **Hard rule: no command may take more than 5 minutes.** The network is slow (about 220 KB/s from npm), so install with `npm install --prefer-offline --no-audit --no-fund` and reuse packages already on disk. Run anything long in the background and never sit waiting on a hung command.
- **UI is being built in a separate chat** (with the Agentation toolbar for fixing UI, no MCP server). The Next.js app will live at the **repo root**. Coordinate with that work instead of duplicating it. It uses mock data behind selector functions (`src/lib/mock/`), which the real build swaps for database queries. Specs are in `docs/specs/`.
- **Timebox:** the hackathon runs **today, Sat 31 Oct 2026, 09:00–17:00 IST**. The UI work started at about 11:20.

## Team

| Developer | GitHub | Noreply email for commits |
|---|---|---|
| Labeeb Hameed (lead) | `LabeebHameed` | `182422045+LabeebHameed@users.noreply.github.com` |
| Vishnu KR | `vishnuu-kr` | `186273563+vishnuu-kr@users.noreply.github.com` |
| Mohammed Yasin | `bababooyii` | `198542287+bababooyii@users.noreply.github.com` |
| Don Savio | `Rickasslee` | `111143665+Rickasslee@users.noreply.github.com` |

All four accounts are logged in to `gh` (switch with `gh auth switch -u <login>`). The organizers want each of the four teammates to push at least once an hour.

**Attribution rule:** every commit is authored by, and pushed from, the account of the person who actually did that work. Never push under a teammate's account to cover for them while they're away. If someone is unavailable, their lane waits for them or is reassigned in the open. When it's unclear whether the organizers would accept a plan, flag it to me rather than working around it.

## First job: the team plan

1. **Repo:** create the GitHub repo under `LabeebHameed` and add the other three as collaborators. Ask me before creating it whether it should be public or private, since hackathons often require public. Set up `main` protection, `.github/workflows/ci.yml` (typecheck, lint, test, build) and `.github/pull_request_template.md`, following my global CLAUDE.md workflow.
2. **Branching:** `main` changes only through reviewed PRs. Feature branches are `feat/<nn>-<name>`, with conventional commits. Define how the lanes merge without conflicts, including who owns the shared files (schema, layout, `lib/ui.ts`) and the order in which schema migrations land.
3. **Workload split:** split the build into four lanes **with disjoint file ownership**. Starting proposal, which you should refine:
   - **Labeeb:** foundation, auth & roles, billing engine and pricing, integration, PR review.
   - **Vishnu:** catalog (products, variants, plans, taxes, quotation templates).
   - **Yasin:** subscriptions lifecycle, discounts, payments.
   - **Don Savio:** finance dashboard, customer portal, invoice print/PDF, seed data (5k+ subscriptions) and perf.
4. **Hour-by-hour schedule (now → 17:00):** for each developer and each hour, list the branch, the concrete commit-sized tasks, and the PR/merge points. Add a demo-prep slot from 16:15 onwards. Mark which tasks are cut first if we fall behind.
5. **Per-developer setup:** git config per commit (`git -c user.name=… -c user.email=…`, or one worktree per dev with local config) and how each person pushes from their own account.
6. Write the plan to `docs/team-plan.md`, show it to me, and wait for my OK before creating the repo or pushing anything.

## After that: phase hub

Run each phase from the plan the same way:

1. Write a self-contained spec (files, interfaces, tests, done criteria).
2. Hand it to an `implementer` subagent, and mechanical work to `grunt`. Run subagents in parallel only when their files don't overlap.
3. Review the full diff, then run typecheck, lint, tests and build, and check UI in the browser.
4. Commit in the owning lane, push, get CI green, then open the PR with the full description template.

Keep `docs/team-plan.md` up to date as the live status board.
