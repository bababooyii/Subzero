# UI-03 Swap mock data for the real backend

Goal: every screen reads and writes through the real backend. Afterwards `src/lib/mock/` is deleted. **The UI must look and behave exactly as it does now.** Don't change the design; only the data source changes.

Read first: `docs/ui-backend-map.md` (every mock selector → real function), `docs/specs/conventions.md`, and the backend code under `src/features/*`, `src/server/*`, `src/lib/{auth,dates,money,pagination,action-result}.ts`. Also keep the UI design docs in mind: `docs/design-system.md` and `docs/design-adaptation.md` (fit to screen, one toast, no native selects, click-to-confirm).

## Rules
- **Pages are server components.** Use `import { db } from "@/db/client"`, then `await` the query inside the existing `<Suspense>` pattern (`cacheComponents: true`: anything awaiting params, searchParams or data sits inside Suspense). Pass plain serialisable props to the client views.
- **Money** is integer paise and **dates** are `YYYY-MM-DD` strings. Keep using `src/lib/format.ts` for display.
- **"Today"** comes from `todayIST()` (`@/lib/dates`). Remove every use of `src/lib/mock/clock.ts`.
- **Pricing:** the one pricing function is `price()` from `@/server/pricing`. Live totals in client forms call it directly (it's pure). Delete `src/lib/mock/pricing.ts`.
- **Writes** go through server actions returning `ActionResult`. On success, call `router.refresh()` (or rely on the action's `revalidatePath`) instead of local optimistic state, unless a local tweak is needed for the fly-out animations.
  - On `{ ok: false }`, show `error` in a toast and `fieldErrors` under the fields.
  - Undo toasts call the inverse action where one exists (pause ↔ resume; payment → `deletePaymentAction`). Otherwise drop the Undo and use a plain toast.
- **Auth:** the session decides the role. Remove the demo role switcher from the account menu, and gate Catalog and Settings by `actor.role === "admin"`.
- **Not built in the backend** (`recentActivity`, `searchIndex`, `listUsers`): hide the feature, or keep a tiny local fallback with a `// TODO(backend)` comment. Don't import `src/lib/mock` for it.

## Server-paged tables: the `DataTable` contract (Lane A builds it, other lanes use it)
`DataTable` gains an optional `paging` prop: `{ total: number; page: number; pageSize: number }` (1-based `page`).
- When `paging` is given, the table renders `data` as-is (one server page). The footer reads "21–40 of 4,812". Prev/next do `router.replace` with `?page=N`, keeping the other params.
- **Auto-fit** measures how many rows fit and, when that differs from `paging.pageSize`, does `router.replace` with `?size=N&page=1` (debounced 150ms, `scroll: false`). The server reads `size` (default 12, clamped 3..100) and passes it as `pageSize` to the query.
- Sorting in paged mode: clicking a header writes `?sort=<columnId>&dir=asc|desc`. Disable client sorting.
- A shared helper `readPaging(searchParams)` in `src/lib/table-params.ts` returns `{ page, pageSize, sort, dir, q }`, so every list page parses params the same way.
- Without `paging`, `DataTable` behaves exactly as now: small embedded tables stay client-side.

## Checking your work (local installs are too slow; checks run in the team Codespace)
`scripts/cs-check.sh <lane>` syncs this checkout into its own Codespace folder and runs `tsc` + `eslint` there (about 30s). Pass a command to run something else, e.g. `scripts/cs-check.sh subs "pnpm vitest run src/features/subscriptions"`. Use your lane name so parallel agents don't collide.
- No command may run longer than 5 minutes.
- Don't run installs locally.
- Don't run git, and don't push.
- The local dev server on :3000 can't run the backend (there's no local DB or backend deps), so don't rely on it.

## Lanes and file ownership
- **A, shell and auth:**
  - `src/components/ui/DataTable.tsx`, `src/lib/table-params.ts`, `src/components/shell/**`
  - `src/app/(app)/layout.tsx`, `src/app/(portal)/layout.tsx`, `src/app/(auth)/**`, `src/components/auth/**`
  - `src/app/(app)/settings/**`, `src/components/settings/**`
  - **Tasks:** session-backed layouts (`requireActor`; customers are redirected to `/portal` and staff away from it), real `navCounts`, the role context fed from the session, Better Auth sign-in/up/reset with `passwordRules`, and staff creation.
- **B, subscriptions and customers:** `src/app/(app)/subscriptions/**`, `src/app/(app)/customers/**`, `src/components/subscriptions/**`, `src/components/customers/**`.
- **C, billing, invoices and payments:** `src/app/(app)/billing/**`, `src/app/(app)/invoices/**`, `src/app/(app)/payments/**`, `src/app/(print)/**`, `src/components/billing/**`, `src/components/payments/**`.
- **D, dashboard and catalog:** `src/app/(app)/dashboard/**`, `src/components/dashboard/**`, `src/app/(app)/catalog/**`, `src/components/catalog/**`.
- **E, portal:** `src/app/(portal)/portal/**`, `src/components/portal/**`.

Only touch your own files. If you need a change in a shared file you don't own, report it instead of making it. `src/lib/mock/*` is deleted at the end by the orchestrator, once nothing imports it. Your lane is done when **no file you own imports `@/lib/mock`**.
