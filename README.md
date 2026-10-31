# Subzero

Subscription management and recurring billing for "Brightloop Software", built for the Odoo hackathon (31 Oct 2026).

Team: Labeeb Hameed (lead), Vishnu KR, Mohammed Yasin, Don Savio.

- Team plan and live status board: [docs/team-plan.md](docs/team-plan.md)
- Design: [docs/design-system.md](docs/design-system.md), [docs/design-adaptation.md](docs/design-adaptation.md)

## Setup

Prerequisites: Node 24, pnpm 10, Docker.

```bash
cp .env.example .env
pnpm i
pnpm db:up        # Postgres 16 on :5432, Mailpit on :1025 (SMTP) / :8025 (UI)
pnpm db:migrate
pnpm db:seed      # admin@brightloop.test (password from SEED_ADMIN_PASSWORD)
pnpm dev
```

Mailpit (password-reset emails) is at http://localhost:8025.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js dev server / production build / serve the build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` / `test:watch` | Vitest (DB tests need `TEST_DATABASE_URL`) |
| `pnpm db:up` | `docker compose up -d` |
| `pnpm db:generate` | Generate a Drizzle migration from the schema |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:reset` | Drop and recreate the public schema, then migrate |
| `pnpm db:seed` | Seed data (currently the admin user only) |

## Engineering rules (non-negotiable, checked in review)

1. One invoice per (subscription, period): `UNIQUE (subscription_id, period_start)`. A test runs billing twice and asserts the count is unchanged.
2. Every status change goes through `src/server/state-machine`. No `update(...).set({ status })` anywhere else (`scripts/check-status-writes.sh` enforces this in CI).
3. Prices, taxes and discounts come from one pure function, `src/server/pricing/price.ts`, with unit tests.
4. Money is `integer` minor units (paise) everywhere. Tax rates are basis points. Format only at the edge (Indian grouping, ₹).
5. Invoice lines snapshot product name, variant, unit price, qty and tax rate when created. They never join back to the catalog for amounts.
6. `activity_log` records every state change (entity, from, to, actor, at, meta).
