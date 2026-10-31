# UI-02 Fit to screen (user feedback round 3)

## The user's rules (non-negotiable)
1. **The app never scrolls.** No page-level scrollbar at any window size from about 1280×720 up. Every page fits the user's actual viewport height, whatever it is. Don't design for one standard size.
2. **Show only what fits.** Never cram 40 rows into a frame. Tables work out how many rows fit the available height and paginate to that. Longer secondary content goes in a fixed-height `ScrollPanel` (internal scroll with soft edge fades), never in page scroll.
3. **No scrollbar layout shift.** Nothing may push the layout sideways when a scrollbar appears or disappears.
4. **The page indicator sits in the same place on every page.** The icon tile and title are at identical x/y on Dashboard, Products, Invoices and every other page. The tile pops in the same spot whenever you change page.
5. **View switches feel smooth.** Switching a `PillSwitch`/`SavedViews` option, or changing page, transitions the content in. It never snaps.
6. **Tables breathe.** More generous row height and padding, applied to every table.

Below about 640px wide or 600px tall, falling back to normal page scroll is fine.

## Part 1: Shared foundation (one agent, runs first)

### Shell
- `src/app/globals.css`:
  - `html, body { height: 100%; overflow: hidden; }` at `sm` and up. Below `sm` it may scroll.
  - Add a utility `.scroll-quiet` (`scrollbar-width: none`, hide `::-webkit-scrollbar`) for internal panels.
  - Add keyframes `content-in`: from `opacity:0; transform: translateY(6px)`, 0.26s `cubic-bezier(.2,.8,.2,1)`, exposed as `--animate-content-in`.
- `AppShell`: the root is `flex h-dvh overflow-hidden`. The sidebar stays full height. The right column is `flex min-w-0 flex-1 flex-col`. `TopBar` is `shrink-0` (no longer needs sticky). `main` is `min-h-0 flex-1 overflow-hidden`, or `overflow-auto` below `sm`.
- Apply the same treatment to `PortalShell` (header `shrink-0`, main fills and hides overflow).

### `PageGrid` (`src/components/ui/PageGrid.tsx`)
- One width for every page: full width of `main`, padded `px-8 pb-6`, with **no per-page max-width**, so the header is always in the same spot. `width="wide"` and `"default"` become identical. `width="form"` only caps the *content* at 760px.
- Root: `flex h-full min-h-0 flex-col`.
- Header: **fixed height `h-14`**, `shrink-0`, `mb-5`, title block on the left and toolbar on the right, vertically centred. Same markup on every page.
- Content: `relative min-h-0 flex-1`, wrapped in a new client `ContentTransition` that re-keys on pathname + search string and plays `animate-content-in`. Use `useSearchParams` inside `<Suspense>`, per the `cacheComponents` rule.
  - The header must NOT remount when only the search string changes, so the Intro doesn't re-pop on a view switch.
  - It does remount and pop when the page changes, in the same position.
- Focus layout (`right` given): a centred two-column row inside the content area that fills the height.
- Children get `h-full`, so pages can lay out with flex/grid inside a known height.

### `DataTable` (`src/components/ui/DataTable.tsx`) and the table recipes in `src/lib/ui.ts`
- **Spacing:**
  - header cells `h-10 px-5 text-[12px]`
  - body cells `h-[52px] px-5 text-[13px]`, first column `pl-6`, last column `pr-6`
  - secondary text in cells 12px muted
  - hairline row dividers at 4% white
- **Auto-fit (on by default):**
  - The table root is `flex h-full min-h-0 flex-col`. The body area is `flex-1 min-h-0 overflow-hidden`, and the footer is pinned at the bottom.
  - A `ResizeObserver` on the body area sets `pageSize = max(3, floor(bodyHeight / 52))`, and clamps `pageIndex` when the size shrinks.
  - The `pageSize` prop is ignored while auto-fit is on. Add an `autoFit={false}` opt-out.
- **No height changes on interaction:** the bulk-selection bar replaces the footer's left side ("3 selected · Send · Confirm") instead of being inserted above the table.
- The empty state is centred in the body area.
- Changing view/page: rows fade in with `content-in`, staggered 15ms per row, capped at 10 rows.

### New `ScrollPanel` (`src/components/ui/ScrollPanel.tsx`)
- Based on Kitchen `ScrollFadeList` (`src/components/kitchen/ScrollFadeList.tsx`).
- A `min-h-0 overflow-y-auto scroll-quiet` container with top/bottom fade masks (`mask-image` gradients) that appear only when there is content above or below.
- Props: `className` and `children`.
- Use it for timelines, invoice/subscription lines, long forms and any list that isn't a `DataTable`.

### Pages the foundation agent also fixes
- **Catalog:** remove `CatalogMenu` from `src/app/(app)/catalog/layout.tsx` (keep `AdminGate`) and delete `src/components/catalog/CatalogMenu.tsx`. The sidebar already lists the catalog pages, and the user said the switcher looks out of place.
- **Invoices:** remove the "Run billing" button from the `/invoices` header. The header keeps only the saved views. The user found it pointless there, and the spacing felt off.
- **Dashboard (must fit one screen):**
  - KPI row (`shrink-0`).
  - Below it, `flex-1 min-h-0 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] grid-rows-2 gap-4`:
    - Revenue chart top-left; it must size to its card's height, with no fixed px height.
    - Overdue ageing top-right.
    - Overdue invoices `DataTable` (auto-fit) bottom-left.
    - Recent activity in a `ScrollPanel` bottom-right.
- **Docs:** add a short "Fit to screen" section to `docs/design-adaptation.md` listing the six rules above.

## Part 2: Page refits (four lanes, after Part 1)
Each lane makes its pages fit with no page scroll, using only `PageGrid`'s content height, auto-fit `DataTable`s and `ScrollPanel`s.

- **Record pages** (subscription, invoice, customer, portal subscription): a two-column grid filling the height.
  - The main column holds a fixed top (stepper), a `ScrollPanel` for lines/preview, and pinned totals.
  - The side column holds the details card and a `ScrollPanel` for the timeline.
- **Forms** (new subscription): fields at the top, the lines editor in a `ScrollPanel`, and live totals pinned at the bottom.
- **Plans (Lane D): new card design** (user: "change the card designs"). Replace the Ticket cards with a pricing-card grid that fills the height (6 plans means 3 × 2):
  - The card is the recessed `surface` (`rounded-2xl`, padding 20), with hover lightening the background and no scale.
  - Top row: a small raised interval chip ("Monthly") and, on yearly plans, a muted "Best value" tag.
  - Plan name in 15px medium, then the price in 22px tabular with a muted "/ month"-style suffix.
  - A hairline divider, then a compact list of the rules (lucide check / minus icons, 13px):
    - min qty and availability dates
    - auto-close, closable, pausable, renewable: enabled ones in the text colour, disabled ones at muted/50
  - Footer: "N active subscriptions" in muted text, plus an Edit secondary button.
  - The yearly plan gets an `IridescentFoil` strip only as a thin band (`h-1.5`) across the top edge, not the whole card.
- **Billing run (Lane C)**. User feedback: "too blank compared to the other pages; I like the design, but it's too blank", and the draft card needs more inner padding. Make it a full dashboard-like workspace that fills the height:
  - **Top:** a `shrink-0` row of run-summary `StatTile`s: To bill (count + total), Confirmed, Skipped, Discounts applied, Tax. They update live as cards are handled.
  - **Below it**, `flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_402px_minmax(0,1fr)] gap-8`:
    - **Left:** a **run queue** panel (recessed surface, `ScrollPanel` list) of every draft: customer, SUB number, amount and a status dot (pending / approved / skipped). The current card is highlighted with the `selected` recipe, and clicking a row jumps the deck to it.
    - **Centre:** the hero deck, vertically centred.
    - **Right:** the subscription context as now, plus the customer's last 3 invoices.
  - **DraftCard padding:** increase the inner padding of the card body to `p-6` and the footer to `px-4 py-3`. Increase the line-row spacing (`py-2.5`), keep totals clearly separated by a hairline, and keep the concentric radii correct: outer 26/18, so bottom radius = button radius + inset.
- **No native `<select>` anywhere** (user: "make an appropriate dropdown and use that for all of them"). Every lane replaces the native selects in its files with the shared `Dropdown` (`src/components/ui/Dropdown.tsx`).
- Every lane verifies at 1587×1404 **and** 1440×800 that `document.documentElement.scrollHeight === innerHeight` on each of its pages, and that nothing is clipped awkwardly.
