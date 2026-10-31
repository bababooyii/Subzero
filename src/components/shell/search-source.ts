import type { PaletteGroup } from "./CommandPalette";

/** One ⌘K record hit; `href` is where selecting it goes. */
export type SearchHit = {
  type: "customer" | "subscription" | "invoice" | "product";
  id: string;
  href: string;
  label: string;
  detail?: string;
};

/**
 * Record search for the command palette. Page links only until the backend lands.
 * TODO(backend): swap to globalSearchAction(q) from `@/features/search/actions` (customers, subscriptions, invoices, products).
 */
export async function searchRecords(q: string): Promise<SearchHit[]> {
  void q;
  return [];
}

/** Palette groups shown without typing. Empty while record search is page-links-only. */
export function paletteGroups(): PaletteGroup[] {
  return [];
}
