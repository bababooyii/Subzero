/**
 * Shared class recipes (design-system §4, design-adaptation §3-4).
 * Use these instead of ad-hoc classes. Do not stack two recipes that set the same property.
 */

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Primary: the single white action in an area. */
export const btnPrimary = `inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-text px-2.5 text-[13px] font-medium text-bg hover:opacity-90 disabled:opacity-60 ${focusRing}`;

/** Secondary: raised grey. */
export const btnSecondary = `inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/[0.07] bg-[#232323] px-2.5 text-[13px] text-text shadow-[0_1px_1px_rgba(0,0,0,0.15)] hover:bg-[#2a2a2a] disabled:pointer-events-none disabled:opacity-40 ${focusRing}`;

/** Square icon button with the same raised look. */
export const btnSquare = `inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/[0.07] bg-[#232323] text-muted shadow-[0_1px_1px_rgba(0,0,0,0.15)] hover:bg-[#2a2a2a] hover:text-text disabled:pointer-events-none disabled:opacity-40 ${focusRing}`;

/** Destructive: same shape as secondary, in red. */
export const btnDanger = `inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#f43f5e]/60 bg-[#f43f5e]/10 px-2.5 text-[13px] text-[#f43f5e] shadow-[0_1px_1px_rgba(0,0,0,0.15)] hover:bg-[#f43f5e]/20 disabled:opacity-40 ${focusRing}`;

const fieldBase =
  "rounded-md border border-white/[0.07] bg-[#1c1c1c] px-2.5 text-[13px] text-text shadow-[0_1px_1px_rgba(0,0,0,0.15)] outline-none placeholder:text-muted focus:border-white/20";
/** input, select */
export const field = `h-8 ${fieldBase}`;
/** textarea */
export const fieldArea = `py-2 leading-relaxed ${fieldBase}`;

/** Raised surface (pills, menus, icon buttons). No border. */
export const raised =
  "bg-[#1c1c1c] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_3px_rgba(0,0,0,0.3)]";
/** Selected item inside a raised surface. */
export const selected =
  "bg-[#2a2a2a] font-medium text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.25)]";
/** Recessed content card. */
export const surface = "rounded-2xl border border-white/[0.05] bg-white/[0.025]";
export const sectionTitle = "text-[13px] font-medium text-text";

/** Hero card frame (outer). */
export const heroFrame =
  "rounded-[26px] rounded-b-[18px] border border-white/[0.06] bg-[#171717] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]";
/** Hero card body (inner). */
export const heroBody =
  "-m-px rounded-[26px] border border-white/[0.06] bg-[#0c0c0c] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)]";

/** Nav / menu rows. */
export const menuRow =
  "flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-left text-[13px] text-muted outline-none hover:bg-white/5 hover:text-text data-[highlighted]:bg-white/5 data-[highlighted]:text-text";
export const menuPanel = `z-50 rounded-2xl p-1 animate-menu-in ${raised}`;
export const menuDivider = "mx-2 my-1 h-px bg-white/[0.06]";

/** Count chip next to a label. Pass `onSelected` for the selected-row variant. */
export const chip =
  "ml-1 min-w-3.5 rounded-full px-1 text-center text-[10px] leading-[14px] font-medium tabular-nums";
export const chipIdle = `${chip} bg-white/10 text-muted`;
export const chipSelected = `${chip} bg-white/75 text-black`;

/** Status dot + muted label (adaptation §3). */
export const statusDot = "inline-flex items-center gap-1.5 text-[12px] text-muted";
export const statusDotMark = "size-1.5 shrink-0 rounded-full";

/** Data tables (adaptation §4). Generous rows: 40px header, 52px body rows. DataTable auto-fits as many rows as the height allows. */
export const tableWrap = `${surface} overflow-hidden`;
/** Pixel height of a body row (`td`). DataTable falls back to this before it can measure a real row. */
export const TABLE_ROW_H = 52;
export const th =
  "sticky top-0 h-10 whitespace-nowrap border-b border-white/[0.05] px-5 text-left text-[12px] font-medium text-muted first:pl-6 last:pr-6";
export const td = "h-[52px] px-5 text-[13px] first:pl-6 last:pr-6";
export const tr =
  "group relative border-t border-white/[0.04] first:border-t-0 hover:bg-white/[0.03]";
/** Secondary text inside a cell (dates, ids, descriptions). */
export const cellSub = "text-[12px] text-muted";

/** Intro icon tiles (design-system §2). */
export const iconTile = {
  base: "grid size-12 shrink-0 place-items-center rounded-2xl shadow-[inset_0_-2px_0_rgba(0,0,0,0.12)]",
  success: "bg-[#a7f3d0] text-[#047857]",
  danger: "bg-[#fecaca] text-[#b91c1c]",
} as const;

/** Muted helper text. */
export const hint = "text-[12px] text-muted";
