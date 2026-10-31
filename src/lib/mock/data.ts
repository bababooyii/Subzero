import { TODAY_ISO } from "./clock";
import { priceLines } from "./pricing";
import type {
  ActivityEvent,
  Customer,
  Db,
  Discount,
  Interval,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentMethod,
  Plan,
  Product,
  QuotationTemplate,
  Subscription,
  SubscriptionLine,
  SubscriptionStatus,
  Tax,
  User,
} from "./types";

/* ---------- seeded PRNG (no Math.random anywhere) ---------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- ISO date helpers (UTC, "YYYY-MM-DD") ---------- */

const fromISO = (s: string) => new Date(`${s}T00:00:00Z`);
const toISO = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => toISO(new Date(fromISO(s).getTime() + n * 86400000));
export function addMonths(s: string, n: number) {
  const d = fromISO(s);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toISO(target);
}
export const daysBetween = (a: string, b: string) =>
  Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);

function periodStart(start: string, interval: Interval, k: number) {
  switch (interval) {
    case "daily":
      return addDays(start, k);
    case "weekly":
      return addDays(start, 7 * k);
    case "monthly":
      return addMonths(start, k);
    case "yearly":
      return addMonths(start, 12 * k);
  }
}

/* ---------- static catalog ---------- */

const NAMES: [string, string, string][] = [
  ["Sharma Textiles Pvt Ltd", "Rohit Sharma", "Surat"],
  ["Iyer & Sons Traders", "Lakshmi Iyer", "Chennai"],
  ["Greenleaf Organics", "Neha Kapoor", "Pune"],
  ["Patel Auto Components", "Jignesh Patel", "Ahmedabad"],
  ["Bluewave Logistics", "Arjun Nair", "Kochi"],
  ["Kapoor Dental Care", "Dr. Anil Kapoor", "Delhi"],
  ["Madhuri Sweets & Snacks", "Madhuri Joshi", "Nashik"],
  ["Orchid Hospitality", "Farah Siddiqui", "Hyderabad"],
  ["Rao Engineering Works", "Suresh Rao", "Bengaluru"],
  ["Sundaram Hardware Mart", "K. Sundaram", "Coimbatore"],
  ["Nimbus Digital Studio", "Ishita Banerjee", "Kolkata"],
  ["Verma Pharma Distributors", "Pankaj Verma", "Lucknow"],
  ["Anand Packaging Co.", "Anand Mehta", "Vadodara"],
  ["Pixel & Print", "Tanvi Deshmukh", "Mumbai"],
  ["Hari Om Agro Foods", "Hari Prasad", "Indore"],
  ["Saffron Kitchens", "Meenal Kulkarni", "Pune"],
  ["Lotus Wellness Spa", "Radhika Menon", "Thiruvananthapuram"],
  ["Singh Steel Traders", "Gurpreet Singh", "Ludhiana"],
  ["Cedar Interiors", "Aditi Rao", "Bengaluru"],
  ["Bhatia Electronics", "Vikram Bhatia", "Delhi"],
  ["Mehta Chartered Accountants", "Hetal Mehta", "Mumbai"],
  ["Urban Roots Cafe", "Sameer Khan", "Jaipur"],
  ["Trinity Coaching Centre", "Joseph Thomas", "Kochi"],
  ["Kumar Printing Press", "Rajesh Kumar", "Patna"],
  ["Daksh IT Solutions", "Daksh Agarwal", "Noida"],
  ["Pavitra Jewellers", "Pavitra Shetty", "Mangaluru"],
  ["Ganesh Fabrication", "Ganesh Pillai", "Nagpur"],
  ["Ocean Pearl Exports", "Yusuf Ansari", "Visakhapatnam"],
  ["Blossom Florists", "Shreya Das", "Kolkata"],
  ["Chauhan Motors", "Deepak Chauhan", "Bhopal"],
  ["Spice Route Foods", "Anjali Pillai", "Kozhikode"],
  ["Tandon Tiles & Marble", "Ramesh Tandon", "Jaipur"],
  ["Skyline Architects", "Nikhil Joshi", "Pune"],
  ["Happy Paws Vet Clinic", "Dr. Smita Rane", "Mumbai"],
  ["Reddy Poultry Farms", "Venkat Reddy", "Hyderabad"],
  ["Fresh Basket Grocers", "Mohan Lal", "Chandigarh"],
  ["Zenith Fitness Club", "Karan Malhotra", "Gurugram"],
  ["Basu Book Depot", "Soumya Basu", "Kolkata"],
  ["Jain Dry Fruits", "Pooja Jain", "Udaipur"],
  ["Techno Craft Machines", "Rakesh Gowda", "Mysuru"],
];

const PRODUCTS: Omit<Product, "id">[] = [
  { name: "Odoo ERP Suite", type: "software", salesPrice: 149900, costPrice: 70000, notes: "Per-seat licence, billed per period.", variants: [
    { attribute: "Brand", value: "Standard", extraPrice: 0 },
    { attribute: "Brand", value: "Odoo", extraPrice: 56000 },
    { attribute: "Brand", value: "White-label", extraPrice: 120000 },
  ] },
  { name: "Cloud Hosting", type: "service", salesPrice: 249900, costPrice: 120000, notes: "Managed hosting with daily backups.", variants: [
    { attribute: "Size", value: "Small", extraPrice: 0 },
    { attribute: "Size", value: "Medium", extraPrice: 80000 },
    { attribute: "Size", value: "Large", extraPrice: 220000 },
  ] },
  { name: "Support Retainer", type: "service", salesPrice: 499900, costPrice: 260000, notes: "Priority support, 8x5.", variants: [] },
  { name: "Onboarding Package", type: "service", salesPrice: 999900, costPrice: 500000, notes: "One-time setup and training.", variants: [] },
  { name: "CRM Seats", type: "software", salesPrice: 79900, costPrice: 30000, notes: "Sales CRM, per seat.", variants: [] },
  { name: "Analytics Add-on", type: "addon", salesPrice: 129900, costPrice: 40000, notes: "Dashboards and scheduled reports.", variants: [] },
  { name: "Domain & SSL", type: "addon", salesPrice: 59900, costPrice: 25000, notes: "Domain renewal and certificate.", variants: [] },
  { name: "POS Hardware Kit", type: "hardware", salesPrice: 1499900, costPrice: 980000, notes: "Tablet, printer and cash drawer.", variants: [] },
];

const TAXES: Tax[] = [
  { id: "tax-gst18", name: "GST 18%", rate: 18 },
  { id: "tax-gst12", name: "GST 12%", rate: 12 },
  { id: "tax-gst5", name: "GST 5%", rate: 5 },
  { id: "tax-exempt", name: "Exempt", rate: 0 },
];

const PLANS: Omit<Plan, "id">[] = [
  { name: "Daily Trial", price: 4900, interval: "daily", minQty: 1, startDate: "2026-01-01", endDate: null, autoClose: true, closable: true, pausable: false, renewable: false },
  { name: "Weekly Sprint", price: 34900, interval: "weekly", minQty: 1, startDate: "2026-01-01", endDate: null, autoClose: false, closable: true, pausable: true, renewable: true },
  { name: "Starter Monthly", price: 99900, interval: "monthly", minQty: 1, startDate: "2025-01-01", endDate: null, autoClose: false, closable: true, pausable: true, renewable: true },
  { name: "Growth Monthly", price: 249900, interval: "monthly", minQty: 3, startDate: "2025-01-01", endDate: null, autoClose: false, closable: true, pausable: true, renewable: true },
  { name: "Business Yearly", price: 2499900, interval: "yearly", minQty: 5, startDate: "2025-01-01", endDate: null, autoClose: false, closable: false, pausable: true, renewable: true },
  { name: "Enterprise Yearly", price: 5999900, interval: "yearly", minQty: 10, startDate: "2025-01-01", endDate: "2027-12-31", autoClose: true, closable: false, pausable: false, renewable: true },
];

const INTERVAL_FACTOR: Record<Interval, number> = { daily: 0.04, weekly: 0.2, monthly: 1, yearly: 10 };

const STAFF = ["Asha Menon", "Ravi Kulkarni", "Meera Shah"];

/* ---------- generator ---------- */

function build(): Db {
  const rand = mulberry32(20261031);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const chance = (p: number) => rand() < p;
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const pad = (n: number, w: number) => String(n).padStart(w, "0");

  const users: User[] = [
    { id: "u-asha", name: "Asha Menon", email: "asha@brightloop.test", role: "admin" },
    { id: "u-ravi", name: "Ravi Kulkarni", email: "ravi@brightloop.test", role: "staff" },
    { id: "u-meera", name: "Meera Shah", email: "meera@brightloop.test", role: "staff" },
  ];

  const customers: Customer[] = NAMES.map(([name, contactName, city], i) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14);
    return {
      id: `cus-${pad(i + 1, 2)}`,
      name,
      contactName,
      email: `accounts@${slug}.in`,
      phone: `+91 9${int(100, 999)}${int(10000, 99999)}`,
      city,
      gstin: `${int(10, 37)}${"ABCDEFGHJKLMNPQRSTUVWXYZ".charAt(int(0, 23))}${"ABCDEFGHJKLMNPQRSTUVWXYZ".charAt(int(0, 23))}${"ABCDEFGHJKLMNPQRSTUVWXYZ".charAt(int(0, 23))}${"ABCDEFGHJKLMNPQRSTUVWXYZ".charAt(int(0, 23))}${"ABCDEFGHJKLMNPQRSTUVWXYZ".charAt(int(0, 23))}${int(1000, 9999)}A1Z${int(0, 9)}`,
      createdAt: addDays("2025-06-01", int(0, 300)),
    };
  });

  const products: Product[] = PRODUCTS.map((p, i) => ({ ...p, id: `prd-${pad(i + 1, 2)}` }));
  const plans: Plan[] = PLANS.map((p, i) => ({ ...p, id: `pln-${pad(i + 1, 2)}` }));
  const planBy = (interval: Interval) => plans.filter((p) => p.interval === interval);

  const templates: QuotationTemplate[] = [
    { id: "tpl-01", name: "Starter bundle", validityDays: 15, planId: "pln-03", lines: [{ productId: "prd-05", qty: 3 }, { productId: "prd-07", qty: 1 }] },
    { id: "tpl-02", name: "Growth stack", validityDays: 30, planId: "pln-04", lines: [{ productId: "prd-01", qty: 5 }, { productId: "prd-02", qty: 1 }, { productId: "prd-06", qty: 1 }] },
    { id: "tpl-03", name: "Enterprise rollout", validityDays: 45, planId: "pln-06", lines: [{ productId: "prd-01", qty: 20 }, { productId: "prd-03", qty: 1 }, { productId: "prd-04", qty: 1 }] },
  ];

  const discounts: Discount[] = [
    { id: "dsc-01", name: "Diwali Dhamaka 10%", type: "percent", value: 10, minPurchase: 0, minQty: 1, start: "2026-10-15", end: "2026-11-15", usageLimit: null, timesUsed: 0, scope: "products", targetIds: ["prd-01", "prd-02", "prd-05"] },
    { id: "dsc-02", name: "Annual saver ₹1,500 off", type: "fixed", value: 150000, minPurchase: 1000000, minQty: 1, start: "2026-04-01", end: "2027-03-31", usageLimit: null, timesUsed: 0, scope: "subscription", targetIds: [] },
    { id: "dsc-03", name: "Launch offer 15%", type: "percent", value: 15, minPurchase: 0, minQty: 1, start: "2026-04-01", end: "2026-06-30", usageLimit: null, timesUsed: 0, scope: "products", targetIds: ["prd-06", "prd-07"] },
    { id: "dsc-04", name: "Early bird 20%", type: "percent", value: 20, minPurchase: 0, minQty: 2, start: "2026-05-01", end: "2026-12-31", usageLimit: 0, timesUsed: 0, scope: "products", targetIds: ["prd-03", "prd-05"] },
  ];

  const lineCounter = { n: 0 };
  function makeLines(interval: Interval): SubscriptionLine[] {
    const count = interval === "daily" || interval === "weekly" ? 1 : int(1, 3);
    const chosen = new Set<number>();
    while (chosen.size < count) chosen.add(int(0, products.length - (interval === "yearly" ? 1 : 2)));
    return [...chosen].map((pi) => {
      const prod = products[pi];
      const variant = prod.variants.length ? pick(prod.variants) : undefined;
      const factor = INTERVAL_FACTOR[interval];
      const unit = Math.round(((prod.salesPrice + (variant?.extraPrice ?? 0)) * factor) / 100) * 100;
      const discountId = chance(0.14)
        ? pick(discounts.filter((d) => d.scope === "products" && d.targetIds.includes(prod.id)))?.id
        : undefined;
      lineCounter.n += 1;
      return {
        id: `sl-${lineCounter.n}`,
        productId: prod.id,
        description: variant ? `${prod.name} (${variant.attribute}: ${variant.value})` : prod.name,
        variant: variant ? `${variant.attribute}: ${variant.value}` : undefined,
        qty: interval === "yearly" ? int(5, 15) : interval === "monthly" ? int(1, 8) : int(1, 3),
        unitPrice: unit,
        taxId: pick(["tax-gst18", "tax-gst18", "tax-gst18", "tax-gst12", "tax-gst5", "tax-exempt"]),
        discountId,
      };
    });
  }

  /* ----- subscriptions ----- */
  type Spec = { status: SubscriptionStatus; interval: Interval; start: string; due?: boolean; closedAt?: string; pausedAt?: string };
  const specs: Spec[] = [];

  // 14 due to bill today: 2 daily, 4 weekly, 5 monthly, 3 yearly.
  for (let i = 0; i < 2; i++) specs.push({ status: "active", interval: "daily", start: addDays(TODAY_ISO, -int(3, 5)), due: true });
  for (let i = 0; i < 4; i++) specs.push({ status: "active", interval: "weekly", start: addDays(TODAY_ISO, -7 * int(2, 9)), due: true });
  // Start dates on the 31st so every period (clamped from the start) lands on Oct 31 today.
  const monthlyDue = [2, 3, 5, 7, 9];
  monthlyDue.forEach((k) => specs.push({ status: "active", interval: "monthly", start: addMonths(TODAY_ISO, -k), due: true }));
  for (let i = 0; i < 3; i++) specs.push({ status: "active", interval: "yearly", start: addMonths(TODAY_ISO, -12), due: true });

  // Remaining active.
  for (let i = 0; i < 74; i++) {
    const r = rand();
    const interval: Interval = r < 0.12 ? "weekly" : r < 0.8 ? "monthly" : "yearly";
    let start: string;
    if (interval === "weekly") start = addDays(TODAY_ISO, -(7 * int(2, 9) + int(1, 6)));
    else if (interval === "monthly") start = addDays(addMonths(TODAY_ISO, -int(1, 9)), -int(1, 27));
    else start = addDays(addMonths(TODAY_ISO, -int(1, 11)), -int(1, 27));
    specs.push({ status: "active", interval, start });
  }
  for (let i = 0; i < 10; i++) {
    const interval: Interval = chance(0.8) ? "monthly" : "yearly";
    specs.push({ status: "paused", interval, start: addDays(addMonths(TODAY_ISO, -int(3, 9)), -int(1, 27)), pausedAt: addDays(TODAY_ISO, -int(8, 40)) });
  }
  for (let i = 0; i < 18; i++) {
    const interval: Interval = chance(0.15) ? "daily" : chance(0.8) ? "monthly" : "weekly";
    const closedAt = addDays(TODAY_ISO, -int(10, 120));
    const start = interval === "daily" ? addDays(closedAt, -int(3, 6)) : interval === "weekly" ? addDays(closedAt, -7 * int(3, 8)) : addMonths(closedAt, -int(2, 8));
    specs.push({ status: "closed", interval, start, closedAt });
  }
  for (let i = 0; i < 8; i++) specs.push({ status: "confirmed", interval: chance(0.8) ? "monthly" : "yearly", start: addDays(TODAY_ISO, int(1, 20)) });
  for (let i = 0; i < 14; i++) specs.push({ status: "quotation", interval: pick(["monthly", "monthly", "yearly"] as Interval[]), start: addDays(TODAY_ISO, int(5, 40)) });
  for (let i = 0; i < 12; i++) specs.push({ status: "draft", interval: pick(["monthly", "monthly", "yearly", "weekly"] as Interval[]), start: addDays(TODAY_ISO, int(5, 60)) });

  // Order by start date so numbers feel chronological.
  specs.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

  const subscriptions: Subscription[] = [];
  const subMeta = new Map<string, Spec>();
  specs.forEach((spec, idx) => {
    const plan = pick(planBy(spec.interval));
    let start = spec.start;
    // Non-due active subs must not have a period starting exactly today.
    if (spec.status === "active" && !spec.due && spec.interval !== "weekly") {
      for (let k = 0; k < 40; k++) if (periodStart(start, spec.interval, k) === TODAY_ISO) start = addDays(start, 1);
    }
    const number = `SUB-${pad(idx + 1, 4)}`;
    const expiry = spec.closedAt ?? addMonths(start, spec.interval === "yearly" ? 24 : 12);
    let next: string | null = null;
    if (spec.status === "active") {
      for (let k = 0; k < 400; k++) {
        const p = periodStart(start, spec.interval, k);
        if (p >= TODAY_ISO) {
          next = p;
          break;
        }
      }
    } else if (spec.status === "confirmed") next = start;
    const sub: Subscription = {
      id: number.toLowerCase(),
      number,
      customerId: pick(customers).id,
      planId: plan.id,
      status: spec.status,
      startDate: start,
      expiryDate: expiry < TODAY_ISO && spec.status !== "closed" ? addMonths(expiry, 12) : expiry,
      paymentTerms: pick(["Net 15", "Net 15", "Net 30", "Net 30", "Immediate"]),
      nextBillingDate: next,
      lines: makeLines(spec.interval),
    };
    subscriptions.push(sub);
    subMeta.set(sub.id, spec);
  });

  // discount usage
  for (const s of subscriptions) for (const l of s.lines) {
    const d = discounts.find((x) => x.id === l.discountId);
    if (d) d.timesUsed += 1;
  }
  const d4 = discounts[3];
  d4.usageLimit = Math.max(d4.timesUsed, 1);
  d4.timesUsed = d4.usageLimit;
  discounts.forEach((d) => {
    d.timesUsed += d.id === "dsc-01" ? 12 : d.id === "dsc-02" ? 7 : 0;
  });

  /* ----- invoices + payments ----- */
  const WINDOW_START = "2026-05-01";
  const invoicesRaw: Omit<Invoice, "id" | "number">[] = [];
  const paymentsByInv: Omit<Payment, "id" | "invoiceId">[][] = [];

  for (const sub of subscriptions) {
    const spec = subMeta.get(sub.id)!;
    if (!["active", "paused", "closed"].includes(sub.status)) continue;
    const plan = plans.find((p) => p.id === sub.planId)!;
    const limit = spec.closedAt ?? spec.pausedAt ?? TODAY_ISO;
    const termDays = sub.paymentTerms === "Immediate" ? 0 : sub.paymentTerms === "Net 15" ? 15 : 30;
    const periods: { s: string; e: string }[] = [];
    for (let k = 0; k < 400; k++) {
      const ps = periodStart(sub.startDate, plan.interval, k);
      if (ps >= limit) break;
      if (ps >= WINDOW_START) periods.push({ s: ps, e: addDays(periodStart(sub.startDate, plan.interval, k + 1), -1) });
    }
    for (const per of periods.slice(-6)) {
      const lines: InvoiceLine[] = sub.lines.map((l, i) => {
        const gross = Math.round(l.qty * l.unitPrice);
        const dsc = discounts.find((d) => d.id === l.discountId);
        const off = dsc ? (dsc.type === "percent" ? Math.round((gross * dsc.value) / 100) : Math.min(gross, dsc.value)) : 0;
        return {
          id: `il-${i}`,
          description: l.description,
          qty: l.qty,
          unitPrice: l.unitPrice,
          taxRate: TAXES.find((t) => t.id === l.taxId)?.rate ?? 0,
          amount: gross - off,
        };
      });
      const t = priceLines(sub.lines, TAXES, discounts);
      const due = addDays(per.s, termDays);
      const age = daysBetween(due, TODAY_ISO);
      let status: Invoice["status"] = "confirmed";
      let paid = 0;
      const r = rand();
      if (r < 0.02) status = "cancelled";
      else if (per.s >= addDays(TODAY_ISO, -4) && chance(0.35) && sub.status === "active") status = "draft";
      else if (age > 0) {
        if (r < 0.9) {
          status = "paid";
          paid = t.total;
        } else if (r < 0.94) paid = Math.round((t.total * int(30, 70)) / 100 / 100) * 100;
      } else if (r < 0.4) {
        status = "paid";
        paid = t.total;
      }
      const pay: Omit<Payment, "id" | "invoiceId">[] = [];
      if (paid > 0 && status !== "cancelled") {
        const latest = daysBetween(per.s, TODAY_ISO);
        const when = addDays(per.s, Math.min(latest, int(0, Math.max(1, termDays + 8))));
        const method: PaymentMethod = pick(["upi", "upi", "upi", "bank_transfer", "bank_transfer", "card", "cash"]);
        if (status === "paid" && chance(0.15) && paid > 200000) {
          const first = Math.round((paid * 0.5) / 100) * 100;
          pay.push({ customerId: sub.customerId, method, amount: first, date: when, note: "Part 1" });
          pay.push({ customerId: sub.customerId, method: "bank_transfer", amount: paid - first, date: addDays(when, Math.min(daysBetween(when, TODAY_ISO), int(2, 9))), note: "Balance" });
        } else {
          pay.push({ customerId: sub.customerId, method, amount: paid, date: when, note: status === "paid" ? "" : "Advance payment" });
        }
      }
      invoicesRaw.push({
        subscriptionId: sub.id,
        customerId: sub.customerId,
        status,
        periodStart: per.s,
        periodEnd: per.e,
        issueDate: per.s,
        dueDate: due,
        lines,
        subtotal: t.subtotal,
        discountTotal: t.discountTotal,
        taxTotal: t.taxTotal,
        total: t.total,
        amountPaid: status === "cancelled" ? 0 : paid,
      });
      paymentsByInv.push(pay);
    }
  }

  const order = invoicesRaw.map((_, i) => i).sort((a, b) => (invoicesRaw[a].issueDate < invoicesRaw[b].issueDate ? -1 : invoicesRaw[a].issueDate > invoicesRaw[b].issueDate ? 1 : a - b));
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  order.forEach((srcIdx, n) => {
    const number = `INV-${pad(n + 1, 4)}`;
    const inv: Invoice = { ...invoicesRaw[srcIdx], id: number.toLowerCase(), number };
    invoices.push(inv);
    paymentsByInv[srcIdx].forEach((p) => {
      payments.push({ ...p, id: `pay-${pad(payments.length + 1, 4)}`, invoiceId: inv.id });
    });
  });
  payments.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  /* ----- activity events ----- */
  const events: ActivityEvent[] = [];
  const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? "";
  // Events dated today stay before the fixed "now" (10:00 IST).
  const at = (iso: string, h = 10) => `${iso}T${pad(iso === TODAY_ISO ? int(7, 9) : h, 2)}:${pad(int(0, 59), 2)}:00+05:30`;
  let e = 0;
  const push = (ev: Omit<ActivityEvent, "id">) => events.push({ ...ev, id: `ev-${++e}` });
  for (const s of subscriptions) {
    const spec = subMeta.get(s.id)!;
    const created = addDays(s.startDate, -int(2, 12));
    if (created <= TODAY_ISO) push({ at: at(created, 11), actor: pick(STAFF), entity: "subscription", entityId: s.id, text: `${s.number} created for ${custName(s.customerId)}` });
    if (["confirmed", "active", "paused", "closed"].includes(s.status)) {
      const c = addDays(s.startDate, -int(0, 1));
      if (c <= TODAY_ISO) push({ at: at(c, 14), actor: pick(STAFF), entity: "subscription", entityId: s.id, text: `${s.number} confirmed` });
    }
    if (spec.pausedAt) push({ at: at(spec.pausedAt, 16), actor: pick(STAFF), entity: "subscription", entityId: s.id, text: `${s.number} paused` });
    if (spec.closedAt) push({ at: at(spec.closedAt, 12), actor: pick(STAFF), entity: "subscription", entityId: s.id, text: `${s.number} closed` });
  }
  for (const inv of invoices) {
    push({ at: at(inv.issueDate, 9), actor: pick(STAFF), entity: "invoice", entityId: inv.id, text: `Invoice ${inv.number} ${inv.status === "draft" ? "drafted" : "confirmed"} for ${custName(inv.customerId)}` });
  }
  for (const p of payments) {
    const inv = invoices.find((i) => i.id === p.invoiceId)!;
    push({ at: at(p.date, 15), actor: custName(p.customerId), entity: "payment", entityId: inv.id, text: `Payment received for ${inv.number} via ${p.method.replace("_", " ")}` });
  }
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return { users, customers, products, taxes: TAXES, plans, templates, discounts, subscriptions, invoices, payments, events: events.slice(0, 600) };
}

let cached: Db | null = null;
/** Lazily built, deterministic mock database. Same output on every call and every process. */
export function getDb(): Db {
  if (!cached) cached = build();
  return cached;
}
