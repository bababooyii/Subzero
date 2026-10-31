import {
  BoltIcon,
  CustomersIcon,
  DashboardIcon,
  DiscountsIcon,
  HomeIcon,
  InvoicesIcon,
  PaymentsIcon,
  PersonIcon,
  PlansIcon,
  ProductsIcon,
  SlidersIcon,
  SubscriptionsIcon,
  TemplatesIcon,
  type NavIcon,
} from "./icons";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Which count chip to show (a key of the shell's `counts`). */
  chip?: string;
  /** Active only on an exact path match (a section's overview page). */
  exact?: boolean;
};

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/subscriptions", label: "Subscriptions", icon: SubscriptionsIcon, chip: "dueToday" },
  { href: "/billing", label: "Billing run", icon: BoltIcon },
  { href: "/invoices", label: "Invoices", icon: InvoicesIcon, chip: "overdue" },
  { href: "/payments", label: "Payments", icon: PaymentsIcon },
  { href: "/customers", label: "Customers", icon: CustomersIcon },
];

export const CATALOG_NAV: NavItem[] = [
  { href: "/catalog/products", label: "Products", icon: ProductsIcon },
  { href: "/catalog/plans", label: "Plans", icon: PlansIcon },
  { href: "/catalog/templates", label: "Templates", icon: TemplatesIcon },
  { href: "/catalog/discounts", label: "Discounts", icon: DiscountsIcon },
];

export const SETTINGS_NAV: NavItem = { href: "/settings", label: "Settings", icon: SlidersIcon };

/** Customer portal sidebar. */
export const PORTAL_NAV: NavItem[] = [
  { href: "/portal", label: "Overview", icon: HomeIcon, exact: true },
  { href: "/portal/subscriptions", label: "Subscriptions", icon: SubscriptionsIcon },
  { href: "/portal/invoices", label: "Invoices", icon: InvoicesIcon, chip: "unpaid" },
];

export const PORTAL_ACCOUNT_NAV: NavItem = { href: "/portal/account", label: "Account", icon: PersonIcon };
