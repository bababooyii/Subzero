# Backend conventions (all lanes)

Read `docs/team-plan.md` §1 (engineering rules, data model, ownership) first. Schema lives in `src/db/schema/*` (landed in CORE-01). Backend only: **no pages, components or CSS**. A separate UI chat builds screens against mock selectors and will swap in the functions you write.

## Layers
- `src/features/<domain>/service.ts`: plain async functions `fn(db: DB | Tx, input, actor)` that do the work. Validate input with the Zod schema from `schemas.ts`. These are what tests call (against the test DB).
- `src/features/<domain>/queries.ts`: read functions `fn(db, params)` returning plain serialisable objects (dates as `YYYY-MM-DD` strings, money as integer paise).
- `src/features/<domain>/actions.ts`: `"use server"` wrappers: `requireRole(...)` → `service` with the global `db` (inside `db.transaction` when writing) → `revalidatePath` → `ActionResult`.
- `src/features/<domain>/schemas.ts`: Zod schemas + inferred input types (the UI uses them for forms).

## Shared types (from CORE-01)
- `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }` in `src/lib/action-result.ts`, with helpers `ok(data)`, `fail(error, fieldErrors?)`, `fromZodError(err)`.
- List queries take `ListParams = { page?: number; pageSize?: number; q?: string; sort?: string; dir?: "asc" | "desc" }` and return `Paged<T> = { rows: T[]; total: number; page: number; pageSize: number }` (`src/lib/pagination.ts`, helper `toLimitOffset(params)`; default pageSize 50, max 200). Paging, sorting and filtering always happen in SQL.
- `Actor = { id: string; role: "admin" | "staff" | "customer" }`.

## Rules
- Money: integer paise only. Percentages: basis points.
- Status changes **only** through `src/server/state-machine` (`transitionSubscription` / `transitionInvoice`). CI greps for `status:` writes elsewhere.
- Roles: admin = everything. Staff = day-to-day (customers, subscriptions, invoices, payments; **read-only** catalog; no discounts, taxes, users). Customer = only their own records (portal).
- Tests: unit tests `*.test.ts`; DB tests `*.db.test.ts` using `src/test/db.ts` (`testDb`, `truncateAll()`, call it in `beforeEach`). Every service function gets at least a happy-path and a guard/validation test.
- Don't add dependencies. Don't edit files outside your lane (see team-plan §1). If you need a change in another lane's file, stop and report it.
- Before reporting: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` and `bash scripts/check-status-writes.sh`. Don't commit; the lane owner reviews and commits.
