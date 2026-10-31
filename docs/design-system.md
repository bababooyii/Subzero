# Design System

A portable spec of the UI style: a dark, quiet, "raised surfaces" look with one white primary action, Inter type, subtle shadows and small, purposeful motion.

> **Brightloop note:** this spec was written for a social-post approval app. How it maps onto the subscription and billing app (tables, dashboard, status colours, forms) is in [`design-adaptation.md`](design-adaptation.md). Where the two disagree, the adaptation wins.

**For an AI assistant implementing this in another project:** read the whole file first. Then:
1. Add the tokens and global CSS from §2 and §8.
2. Add the class recipes from §4 as shared constants.
3. Restyle the app's existing screens using the component patterns in §5–§7.

Keep the project's own features and data. Change only how things look and move, and respect the rules in §10. The snippets use Tailwind CSS v4, but every value is listed in plain CSS terms too, so the style also works without Tailwind.

---

## 1. Principles

1. **Dark and flat, with depth only where you touch.** The page is near-black. Interactive controls (buttons, pills, menus) are *raised*: a slightly lighter fill, a faint white highlight on the top edge, and a soft dark drop shadow. Static content cards are *recessed*: a barely-there white tint and a hairline border.
2. **One bright thing per area.** The only solid white element in a region is its primary action (e.g. **Approve**, **Save**). Everything else is grey.
3. **Quiet type.** One family (Inter), mostly 13px. Hierarchy comes from weight and grey levels, not size jumps.
4. **Concentric radii.** An outer corner radius = the inner element's radius + the gap between them.
5. **Subtle everything.** Borders are 5–7% white. Shadows are soft (≤ 0.4 black, small blur). If an effect is noticeable at a glance, it's too strong.
6. **Motion explains state.** Things rise in, approved cards fly right, discarded cards fly left, and a temporary intro drains a timer before leaving. Always honour `prefers-reduced-motion`.
7. **Labels stay visible.** Nav items always show icon + label. Counts sit in small chips beside labels, with a gap.

---

## 2. Design tokens

### Colours (dark theme)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#111111` | Page background, also flat surfaces |
| `--surface` | `#111111` | Default surface (kept equal to bg: depth comes from shadows, not fills) |
| `--line` | `#2A2A2A` | Borders, dividers, hairlines |
| `--text` | `#ECECEA` | Primary text, primary button fill |
| `--muted` | `#9A9994` | Secondary text, idle icons |
| `--accent` | `#748FFC` | Focus rings and placeholder highlights only. Never for buttons or selected states. |
| `--accent-soft` | `#1F2440` | Background of highlighted placeholders in text |
| `--danger` | `#FF6B6B` | Error text |
| Raised fill | `#1C1C1C` | Pills, menus, icon buttons, fields |
| Raised selected | `#2A2A2A` | Selected item inside a raised surface |
| Button fill | `#232323` | Secondary buttons (Edit), hover `#2A2A2A` |
| Card frame | `#171717` | Outer frame of the hero card |
| Card body | `#0C0C0C` | Inner post card (slightly darker than the page) |
| Recessed card | `rgba(255,255,255,0.025)` | List/grid cards |
| Destructive | `#F43F5E` | Discard ✕ icon, Delete forever |
| Success tile | bg `#A7F3D0`, icon `#047857` | Intro icon tiles |
| Danger tile | bg `#FECACA`, icon `#B91C1C` | Intro tile for deleted/discarded lists |

Light theme (optional fallback): `--bg #F7F7F5`, `--surface #FFFFFF`, `--line #E6E5E1`, `--text #1C1C1A`, `--muted #6B6A66`. Pages that use the raised hex values above assume dark mode. A light mode needs its own raised palette.

### Typography

- **Family:** Inter (`next/font/google` or Google Fonts), used everywhere. No second font.
- **Base UI size:** 13px. Use 12px for meta/descriptions and 11px for count chips, with medium weight and tabular numbers.
- **Content text** (posts, long lists): 14–15px, `line-height: 1.5`.
- **Page titles:** 18px (`text-lg`), weight 500, `tracking-tight`.
- **Section titles:** 13px, weight 500.
- **Logo/wordmark:** 14–16px, weight 800, letter-spacing `0.025em`, ALL CAPS, one colour.
- **Numbers:** `font-variant-numeric: tabular-nums` for counts and metrics.

### Radii

| Element | Radius |
|---|---|
| Buttons, inputs, selects | 6px (`rounded-md`) |
| Menu items | 12px (`rounded-xl`) |
| Menus, recessed cards, grid cards | 16px (`rounded-2xl`) |
| Hero card (top / bottom) | 26px / 18px. Bottom = 6px button radius + 12px inset. |
| Pills, avatar, chips | full (`rounded-full`) |
| Icon tile | 16px |

### Shadows and borders

| Name | CSS |
|---|---|
| **raised** (pills, menus, icon buttons) | `background:#1C1C1C; box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 3px rgba(0,0,0,0.30);` (no border) |
| **selected** (item inside raised) | `background:#2A2A2A; box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.25);` |
| **button** (Edit-style) | `background:#232323; border:1px solid rgba(255,255,255,0.07); box-shadow: 0 1px 1px rgba(0,0,0,0.15);` |
| **recessed card** | `background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.05); box-shadow: 0 2px 6px -3px rgba(0,0,0,0.25);` |
| **hero card** | frame `#171717` + `1px solid rgba(255,255,255,0.06)` + `0 12px 32px -12px rgba(0,0,0,0.6)`; inner body `#0C0C0C` + same border + `0 4px 12px -4px rgba(0,0,0,0.4)` |
| **overlay backdrop** | `rgba(0,0,0,0.9)` + `backdrop-filter: blur(12px)` |

### Spacing and sizes

- Control height **32px** in forms; **28px** for compact card footers (Edit / ✕ / Approve).
- Horizontal padding: buttons 10px, pills 14px, fields 10px.
- Label → field gap 8px. Field → hint 8px. Between form sections 24px.
- Top bar height 64px, with 16–24px side padding.
- Hero card width **402px** (iPhone 17 Pro point width).

---

## 3. Layout

### App shell
- **Top bar** (64px): the wordmark pill on the left (it opens a projects menu), the section pill nav absolutely centred, and an account/settings round button on the right. All three use the **raised** recipe.
- A sidebar is allowed on the main screens: a raised `rounded-2xl p-1` column built like the settings menu (see `design-adaptation.md` §2). When it is used, the top bar keeps only the wordmark, search and the account button. The content area scrolls under the top bar.

### Three-column "focus" grid (main screens)

```
max-width 1240px, centred, padding 32px
lg: grid-template-columns: minmax(0,1fr) 402px minmax(0,1fr); gap 56px; align-items:center
```
- **Left column:** an intro or menu, right-aligned (`justify-self:end`, `max-width 280px`), sticky at `top: 48px` when the page scrolls.
- **Centre column:** the hero card (402px).
- **Right column:** related context (e.g. the source the card came from), shown as plain content with no card around it, left-aligned with `max-width 360px`.
- Small screens: stack the three columns vertically.

### List/grid screens
Same grid. The left column holds the sticky intro or menu. The content spans the centre and right columns (`grid-column: span 2`, max 760px for forms, unlimited for grids).

### Settings
A persistent **layout** (it must not remount on navigation) holds the settings menu in the left column. Only the right side's content animates when you switch pages.

---

## 4. Class recipes (Tailwind v4)

Drop these into a shared file (e.g. `lib/ui.ts`) and use them everywhere instead of ad-hoc classes.

```ts
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Primary: the single white action in an area (Approve, Save, Add).
export const btnPrimary = `inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-text px-2.5 text-[13px] font-medium text-bg hover:opacity-90 disabled:opacity-60 ${focusRing}`;

// Secondary: raised grey (Edit, Restore, Fetch now).
export const btnSecondary = `inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/[0.07] bg-[#232323] px-2.5 text-[13px] text-text shadow-[0_1px_1px_rgba(0,0,0,0.15)] hover:bg-[#2a2a2a] disabled:pointer-events-none disabled:opacity-40 ${focusRing}`;

// Square icon button with the same raised look (row actions: edit, move, delete).
export const btnSquare = `inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-[#232323] text-muted shadow-[0_1px_1px_rgba(0,0,0,0.15)] hover:bg-[#2a2a2a] hover:text-text disabled:pointer-events-none disabled:opacity-40 ${focusRing}`;

// Destructive: same shape as secondary, in red.
export const btnDanger = `inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#f43f5e]/60 bg-[#f43f5e]/10 px-2.5 text-[13px] text-[#f43f5e] shadow-[0_1px_1px_rgba(0,0,0,0.15)] hover:bg-[#f43f5e]/20 disabled:opacity-40 ${focusRing}`;

// Fields
const fieldBase = "rounded-md border border-white/[0.07] bg-[#1c1c1c] px-2.5 text-[13px] text-text shadow-[0_1px_1px_rgba(0,0,0,0.15)] outline-none placeholder:text-muted focus:border-white/20";
export const field = `h-8 ${fieldBase}`;                    // input, select
export const fieldArea = `py-2 leading-relaxed ${fieldBase}`; // textarea

// Surfaces
export const raised = "bg-[#1c1c1c] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.3)]";
export const selected = "bg-[#2a2a2a] font-medium text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.25)]";
export const surface = "rounded-2xl border border-white/[0.05] bg-white/[0.025]";
export const sectionTitle = "text-[13px] font-medium text-text";
```

Avoid stacking two recipes that set the same property (e.g. two heights or two paddings). Tailwind doesn't guarantee which one wins. Make a separate recipe instead.

---

## 5. Components

### Pill nav (top centre)
- Container: `rounded-full p-1` + **raised**.
- Items: `h-8 px-3.5 rounded-full text-[13px] gap-1.5`, icon (15px, filled style) + label, **always visible**.
- Selected item: **selected** recipe. Idle items: `text-muted hover:text-text`.
- Count chip after the label: `ml-1 min-w-3.5 rounded-full px-1 text-[10px] leading-[14px] font-medium tabular-nums`. On the selected item it's `bg-white/75 text-black`; otherwise `bg-white/10 text-muted`.

### Wordmark / projects menu (top left)
- A pill button: `h-9 px-4 rounded-full` + **raised**, 14px weight 800 caps, and a small chevron that rotates when open.
- Hover: **light up only** (`hover:bg-[#242424]`). No scaling.
- Its menu lists sibling projects. Each row is a 28px letter tile, then the name and a one-line description. The current project uses the **selected** recipe and a ✓. Unavailable projects are shown at 50% opacity as "Coming soon".

### Account / settings button (top right)
- `size-9 rounded-full` + **raised**, with a filled settings icon (two toggle sliders).
- Menu: `rounded-2xl p-1 w-48` + **raised**. Rows are `rounded-xl px-3 py-1.5 text-[13px] gap-2`; the active row uses **selected**, others `text-muted hover:bg-white/5`. Put a divider (`mx-2 h-px bg-white/[0.06]`) before Sign out.

### Dropdown behaviour (all menus)
- Close on an outside click or Escape. Escape returns focus to the trigger.
- Close after navigating.
- Entrance animation: `menu-in` (150ms, from `translateY(-4px) scale(.98)`).

### Hero card (stacked deck)
- Wrapper `relative pt-5`. Up to two "next" cards peek from behind: `absolute top-0/top-2.5 inset-x-7/inset-x-3.5 h-12`, each a frame card at 50% / 80% opacity.
- Frame: `rounded-[26px] rounded-b-[18px]` + hero frame shadow.
- Inner body: `-m-px rounded-[26px] p-4` + hero body (`#0C0C0C`). The inner body has no top highlight.
- Footer inside the frame: `px-3 py-2.5 flex gap-1.5`, with **Edit** on the left (secondary, a filled 11px grey pencil, gap 6px) and **✕** then **Approve** on the right.
  - **✕:** secondary square, with only the icon in `#F43F5E`.
  - **Approve:** primary, with a ✓ icon.
- Variant for discarded items: **Restore** (secondary) on the left, **Delete forever** (danger, trash icon) on the right.
- A small muted date label sits above the card (`Today, Oct 19`), 24px gap, plain text with no chip.

### Social post (inside the hero card)
- Avatar 40px circle on the left, gap 12px, then the content column.
- Header: **name** (bold 15px), a filled blue verified badge `#1D9BF0`, then `@handle · Oct 19` in muted.
- Body: 15px, line-height 1.5, preserve line breaks.
- Media: `aspect-[16/10] rounded-2xl` with a hairline border. Video shows a 40px dark translucent circle with a play icon and a duration chip (bottom-left, `bg-black/70 text-[11px]`).
- Engagement row (only for real data): replies, reposts, likes, views and share, at 13px muted with 17px icons, spread across the width.

### Context post (right column)
The same post layout as above, but **no background, border or card**: just the post, with its real engagement numbers and a link-out icon.

### Intro block (left column)
- A 48px **icon tile** (`rounded-2xl`, tile colours from §2, inset bottom shadow `inset 0 -2px 0 rgba(0,0,0,.12)`) that pops in.
- An 18px title (counts animate up), then an 18px muted subtitle.
- **Temporary intros** (status updates): a thin 80px timer bar (`h-0.5 bg-white/10`, fill `bg-white/40`) drains over ~3.2s, then the block leaves upward.
- **Persistent intros** (list headers) have no timer and don't leave.
- **Empty state:** the same intro, centred on the page and persistent ("No discarded posts" / "Posts you cross out will land here").

### Grid cards (archive views)
- `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap 10px`, grouped under small muted date headings (12px, newest first, 32px between groups).
- Card: **recessed** with 12px padding. A 24px avatar and 11px bold name, 12px text clamped to 4 lines, and optional media (`aspect 16/9, rounded-lg`) pinned to the bottom.
- Hover: `translateY(-2px)`.
- Click opens an **overlay** (darkened, blurred backdrop) with the hero card and its context post side by side. Close with ✕, Escape or a backdrop click, and lock body scroll while it's open.

### Settings menu (left column)
- A **raised** `rounded-2xl p-1` list. Rows are `rounded-xl px-3 py-2`, with a 16px icon, a 13px label and a 12px muted one-line description.
- The active row uses **selected**.
- It lives in a persistent layout, so it doesn't reload or animate between pages.

### Lists and forms
- Lists: **recessed** container with `divide-y divide-white/[0.05]`. Rows are `px-4 py-3 gap-3`, with row actions as `btnSquare` (32px) gaps of 4px. Delete icons turn red on hover.
- Forms: section title, then fields with an 8px label gap and 12px muted hints. Inline add-forms put a field and a primary button side by side at the same 32px height.

### Checkboxes, selects and disclosures (global CSS, §8)
- **Checkbox:** 18px, 5px radius. Off: grey hairline box (`rgba(255,255,255,.04)` with a 14% border). On: soft light fill (`rgba(255,255,255,.2)`) with an off-white tick `#E8E8E6`. Never solid white, never the browser default.
- **Select:** `appearance:none` with a small grey chevron at right 0.6rem.
- **`<details>`/`<summary>`:** hide the browser triangle and use a 12px grey chevron that rotates 90° when open.

### Icons
- Pill nav: **filled**, hand-drawn SVGs (inbox, bookmark, trash, settings sliders) with even-odd cut-outs for inner lines. Plain outline icons filled with `fill="currentColor"` turn into blobs, so don't do that.
- Elsewhere: Lucide outline icons, 14–16px, stroke 1.75–2.

### Toasts
Bottom-centre, small, with an **Undo** action for reversible status changes. No undo for permanent deletes; ask for confirmation first instead.

---

## 6. Motion

| Name | Keyframes | Timing | Use |
|---|---|---|---|
| `rise` | from `opacity:0; translateY(10px)` | 0.5s `cubic-bezier(.2,.8,.2,1)` both | Intro lines, page content (stagger 60–80ms) |
| `pop` | 0% `opacity:0 scale(.5) rotate(-12deg)` → 60% `scale(1.08) rotate(3deg)` | 0.6s same curve | Icon tiles |
| `card-in` | from `opacity:0; translateY(-14px) scale(.94)` | 0.45s same curve | The next card sliding out of the stack; grid cards (stagger 25ms, cap 10) |
| `leave-up` | to `opacity:0; translateY(-10px)` | 0.5s `cubic-bezier(.4,0,.8,.2)`, 3.5s delay, forwards | Temporary intros |
| `drain` | `scaleX(1)` → `scaleX(0)`, `transform-origin:left` | 3.2s linear, 0.3s delay | Intro timer bar |
| `fade-in` | from `opacity:0` | 0.2s ease-out | Overlay backdrop |
| `menu-in` | from `opacity:0; translateY(-4px) scale(.98)` | 0.15s ease-out | Dropdowns |
| Card exit | transition 300ms ease-out to `translateX(±115%) rotate(±6deg) opacity:0` | Wait ~280ms, then navigate | Approve → right, discard → left, restore → up (`-translateY(32px) scale(.95)`) |

**Reduced motion:** set every animation and transition duration to `0.01ms` under `@media (prefers-reduced-motion: reduce)`.

**Tailwind v4 gotcha:** put explanatory comments *outside* `@theme` blocks. A comment inside `@theme` can silently drop the next `--animate-*` variable.

---

## 7. Copy and tone
- Plain, short, friendly: "Your 3 posts are ready!", "I wrote these from today's best posts in your niche.", "You're all caught up!"
- Buttons are verbs: Approve, Edit, Restore, Delete forever, Save, Add.
- Dates: "Today, Oct 19" for today, "Sat, Oct 18" otherwise.

---

## 8. Global CSS (paste into your global stylesheet)

```css
@import "tailwindcss";

:root {
  --bg: #f7f7f5; --surface: #ffffff; --line: #e6e5e1; --text: #1c1c1a; --muted: #6b6a66;
  --accent: #3b5bdb; --accent-soft: #eef1fd; --danger: #c92a2a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111111; --surface: #111111; --line: #2a2a2a; --text: #ececea; --muted: #9a9994;
    --accent: #748ffc; --accent-soft: #1f2440; --danger: #ff6b6b;
  }
}

@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-line: var(--line);
  --color-text: var(--text); --color-muted: var(--muted); --color-accent: var(--accent);
  --color-accent-soft: var(--accent-soft); --color-danger: var(--danger);
  --font-sans: var(--font-inter);
}

/* Checkbox: grey and empty when off, a soft light box with an off-white tick when on. */
input[type="checkbox"] {
  appearance: none; flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.04) center / 12px no-repeat;
  box-shadow: 0 1px 1px rgba(0,0,0,.15); cursor: pointer;
  transition: background-color .15s, border-color .15s;
}
input[type="checkbox"]:checked {
  border-color: rgba(255,255,255,.28); background-color: rgba(255,255,255,.2);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e8e8e6' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E");
}
input[type="checkbox"]:disabled { cursor: default; opacity: .5; }
input[type="checkbox"]:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Disclosure chevron instead of the browser triangle. */
summary { display: flex; align-items: center; gap: .5rem; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary::before {
  content: ""; width: 12px; height: 12px; flex-shrink: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239a9994' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 6 6 6-6 6'/%3E%3C/svg%3E") center / contain no-repeat;
  transition: transform .15s ease;
}
details[open] > summary::before { transform: rotate(90deg); }

/* One dropdown arrow everywhere. */
select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a9994' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right .6rem center; padding-right: 2rem;
}

body { background: var(--bg); color: var(--text); }

/* Motion */
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
@keyframes pop { 0% { opacity: 0; transform: scale(.5) rotate(-12deg); } 60% { opacity: 1; transform: scale(1.08) rotate(3deg); } }
@keyframes card-in { from { opacity: 0; transform: translateY(-14px) scale(.94); } }
/* Temporary intros hold for a few seconds, then leave upward. */
@keyframes leave-up { to { opacity: 0; transform: translateY(-10px); } }
@keyframes drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@keyframes fade-in { from { opacity: 0; } }
@keyframes menu-in { from { opacity: 0; transform: translateY(-4px) scale(.98); } }

@theme inline {
  --animate-rise: rise .5s cubic-bezier(.2,.8,.2,1) both;
  --animate-pop: pop .6s cubic-bezier(.2,.8,.2,1) both;
  --animate-card-in: card-in .45s cubic-bezier(.2,.8,.2,1) both;
  --animate-leave-up: leave-up .5s cubic-bezier(.4,0,.8,.2) 3.5s forwards;
  --animate-drain: drain 3.2s linear .3s both;
  --animate-fade-in: fade-in .2s ease-out both;
  --animate-menu-in: menu-in .15s ease-out both;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

Load Inter (Next.js):

```tsx
import { Inter } from "next/font/google";
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// <html className={`${inter.variable} h-full antialiased`}> ... <body className="min-h-full flex flex-col font-sans">
```

---

## 9. Filled nav icons (SVG, 24×24, `fill="currentColor"`)

```tsx
// Inbox: tray with a cut-out slot
<path fillRule="evenodd" d="M6.6 3h10.8a2 2 0 0 1 1.85 1.24l2.6 6.3c.1.24.15.5.15.76V18a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-6.7c0-.26.05-.52.15-.76l2.6-6.3A2 2 0 0 1 6.6 3Zm-2.1 8.5h3.9c.5 0 .95.3 1.15.76l.45 1.06a1 1 0 0 0 .92.62h2.16a1 1 0 0 0 .92-.62l.45-1.06c.2-.46.65-.76 1.15-.76h3.9l-2.3-5.5H6.8l-2.3 5.5Z"/>
// Bookmark
<path d="M7 2.5h10a2 2 0 0 1 2 2v16.1a.9.9 0 0 1-1.4.75L12 17.6l-5.6 3.75A.9.9 0 0 1 5 20.6V4.5a2 2 0 0 1 2-2Z"/>
// Trash: lid + bin with two cut-out lines
<path d="M9.4 2.5h5.2c.6 0 1.1.4 1.3.95L16.3 5H20a1 1 0 1 1 0 2H4a1 1 0 0 1 0-2h3.7l.4-1.55c.2-.56.7-.95 1.3-.95Z"/>
<path fillRule="evenodd" d="M5.2 8.5h13.6l-.86 11.1A2.5 2.5 0 0 1 15.45 22h-6.9a2.5 2.5 0 0 1-2.49-2.4L5.2 8.5Zm4.55 3a.75.75 0 0 0-.75.75v5.5a.75.75 0 0 0 1.5 0v-5.5a.75.75 0 0 0-.75-.75Zm4.5 0a.75.75 0 0 0-.75.75v5.5a.75.75 0 0 0 1.5 0v-5.5a.75.75 0 0 0-.75-.75Z"/>
// Settings: two toggle sliders
<path fillRule="evenodd" d="M3 6.5A1.5 1.5 0 0 1 4.5 5h6.17a3 3 0 0 1 5.66 0h3.17a1.5 1.5 0 0 1 0 3h-3.17a3 3 0 0 1-5.66 0H4.5A1.5 1.5 0 0 1 3 6.5Zm10.5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM3 17.5A1.5 1.5 0 0 1 4.5 16h2.17a3 3 0 0 1 5.66 0h7.17a1.5 1.5 0 0 1 0 3h-7.17a3 3 0 0 1-5.66 0H4.5A1.5 1.5 0 0 1 3 17.5Zm6.5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"/>
```

---

## 10. Do / Don't

**Do**
- Use one white primary action per area; make everything else grey.
- Use the same height for side-by-side controls (32px in forms).
- Keep borders at 5–7% white and shadows soft.
- Keep menus and nav mounted across navigation; animate only the content.
- Show real numbers only. Placeholder engagement is fine in mockups, but label it.
- Ask for confirmation before permanent deletes. Offer Undo for reversible actions.

**Don't**
- Don't use purple/blue for buttons, selected states or checkboxes (accent is for focus rings only).
- Don't scale things on hover; lighten them instead.
- Don't use solid-white checkboxes, browser-default selects, or the `<details>` triangle.
- Don't mix font families or use sizes above 18px in UI chrome.
- Don't put top inner highlights on content cards (raised controls only).
- Don't add borders to the pill nav or the raised buttons; their depth comes from the shadow.

---

## 11. Implementation checklist for another project

1. Install Inter and set `--font-sans`.
2. Paste §8 into the global CSS and switch to the dark tokens.
3. Create the shared class recipes from §4.
4. Build the top bar: wordmark pill, centred pill nav with count chips, account button with menu.
5. Convert the main screen to the three-column focus grid, with an intro on the left, the hero card in the centre and context on the right.
6. Convert archive/list screens to the left intro + grid, plus an overlay for detail.
7. Move settings into a persistent layout with the left settings menu.
8. Restyle every button, field, checkbox, select and disclosure using the recipes and global CSS.
9. Add the motion in §6 and check reduced-motion.
10. Walk every screen and compare it against §10.
