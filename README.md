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

## Performance

`scripts/perf.ts` times the dashboard queries and the paginated list/search queries (page 1, page 50, and one search term per list) against the demo dataset. Each query runs once as warm-up, then 5 timed runs; it prints p50 and max in ms and exits 1 if any max exceeds 500 ms.

```bash
pnpm demo:reset && pnpm perf
```

Dataset: 400 customers, 5,000 subscriptions, 28,371 invoices and 28,506 payments (deterministic, `SEED=42`, `TODAY=2026-10-31`). Seeding takes 25–110 s depending on the machine (25 s on a quiet Codespace, about 106 s under load).

Search indexes: migration `0001_enable_pg_trgm` enables the `pg_trgm` extension and `0002_search_trgm_indexes` adds GIN trigram indexes on `customers(name)`, `customers(email)`, `invoices(number)` and `subscriptions(number)`, so `ILIKE '%term%'` filters can use an index.

Times in ms, before and after the trigram indexes (single run each, Postgres 16 in a shared Codespace, so expect roughly +/-30% noise):

| Query | p50 before | max before | p50 after | max after |
|---|---:|---:|---:|---:|
| `dashboardKpis` | 162.3 | 187.3 | 152.6 | 196.6 |
| `revenueByMonth(12)` | 188.9 | 256.5 | 95.4 | 132.5 |
| `overdueAgeing` | 12.2 | 36.7 | 5.2 | 7.1 |
| `overdueInvoices(8)` | 2.5 | 9.0 | 1.6 | 2.2 |
| `navCounts` | 1.9 | 4.2 | 1.7 | 3.1 |
| `list subscriptions page 1` | 49.7 | 80.2 | 20.6 | 25.8 |
| `list subscriptions page 50` | 67.6 | 81.1 | 41.2 | 88.7 |
| `list subscriptions page 1, q="0001"` | 67.0 | 226.8 | 76.0 | 181.1 |
| `list invoices page 1` | 31.7 | 34.6 | 15.6 | 32.0 |
| `list invoices page 50` | 60.0 | 187.0 | 26.6 | 28.9 |
| `list invoices page 1, q="0001"` | 294.7 | 370.9 | 152.6 | 178.4 |
| `list payments page 1` | 107.5 | 123.0 | 74.3 | 113.6 |
| `list payments page 50` | 142.9 | 269.3 | 62.1 | 249.7 |
| `list payments page 1, q="0001"` | 272.9 | 345.8 | 236.0 | 254.4 |
| `list customers page 1` | 20.7 | 23.7 | 4.9 | 21.7 |
| `list customers page 50` | 19.4 | 51.0 | 70.0 | 93.8 |
| `list customers page 1, q="ar"` | 39.4 | 217.9 | 18.2 | 73.1 |

Reading the numbers: searching by number alone is now an index scan (an `invoices.number ILIKE` count drops from a sequential scan to about 0.5 ms). The list search ORs `number` with `customers.name` across a join, which Postgres cannot answer from an index, so the invoice and payment searches still scan every row and only improved by the smaller cost of the scan. Rewriting that filter as `number ILIKE ... OR customer_id IN (SELECT id FROM customers WHERE name ILIKE ...)` cut the invoice count from about 146 ms to about 43 ms in testing.

## Engineering rules (non-negotiable, checked in review)

1. One invoice per (subscription, period): `UNIQUE (subscription_id, period_start)`. A test runs billing twice and asserts the count is unchanged.
2. Every status change goes through `src/server/state-machine`. No `update(...).set({ status })` anywhere else (`scripts/check-status-writes.sh` enforces this in CI).
3. Prices, taxes and discounts come from one pure function, `src/server/pricing/price.ts`, with unit tests.
4. Money is `integer` minor units (paise) everywhere. Tax rates are basis points. Format only at the edge (Indian grouping, ₹).
5. Invoice lines snapshot product name, variant, unit price, qty and tax rate when created. They never join back to the catalog for amounts.
6. `activity_log` records every state change (entity, from, to, actor, at, meta).
