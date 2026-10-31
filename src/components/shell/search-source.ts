import { globalSearchAction } from "@/features/search/actions";
import { CustomersIcon, InvoicesIcon, ProductsIcon, SubscriptionsIcon } from "./icons";
import type { PaletteGroup } from "./CommandPalette";

/** One ⌘K record hit; `href` is where selecting it goes. */
export type SearchHit = {
  type: "customer" | "subscription" | "invoice" | "product";
  id: string;
  href: string;
  /** Bold lead (the SUB-/INV- number), when the record has one. */
  lead?: string;
  label: string;
  detail?: string;
};

const sentence = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Record search for the command palette, through `globalSearchAction` (admin and staff). Empty on a blank query or any failure. */
export async function searchRecords(q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (!term) return [];
  const res = await globalSearchAction(term);
  if (!res.ok) return [];
  const { customers, subscriptions, invoices, products } = res.data;
  return [
    ...customers.map((c): SearchHit => ({ type: "customer", id: c.id, href: `/customers/${c.id}`, label: c.name, detail: c.email })),
    ...subscriptions.map(
      (s): SearchHit => ({ type: "subscription", id: s.id, href: `/subscriptions/${s.id}`, lead: s.number, label: s.customerName, detail: sentence(s.status) }),
    ),
    ...invoices.map(
      (i): SearchHit => ({ type: "invoice", id: i.id, href: `/invoices/${i.id}`, lead: i.number, label: i.customerName, detail: sentence(i.displayStatus) }),
    ),
    // Products have no page of their own: they link to the catalog list.
    ...products.map((p): SearchHit => ({ type: "product", id: p.id, href: "/catalog/products", label: p.name })),
  ];
}

const GROUPS: { type: SearchHit["type"]; heading: string; icon: PaletteGroup["icon"] }[] = [
  { type: "customer", heading: "Customers", icon: CustomersIcon },
  { type: "subscription", heading: "Subscriptions", icon: SubscriptionsIcon },
  { type: "invoice", heading: "Invoices", icon: InvoicesIcon },
  { type: "product", heading: "Products", icon: ProductsIcon },
];

/** Grouped palette results for a query. `products: false` drops products (the catalog is admin-only). */
export async function searchGroups(q: string, opts: { products?: boolean } = {}): Promise<PaletteGroup[]> {
  const hits = await searchRecords(q);
  return GROUPS.filter((g) => g.type !== "product" || opts.products !== false).flatMap((g) => {
    const items = hits
      .filter((h) => h.type === g.type)
      .map((h) => ({
        id: `${h.type}:${h.id}`,
        href: h.href,
        value: `${h.type} ${h.lead ?? ""} ${h.label} ${h.detail ?? ""}`,
        lead: h.lead,
        label: h.label,
        trail: h.detail,
      }));
    return items.length ? [{ heading: g.heading, icon: g.icon, items }] : [];
  });
}
