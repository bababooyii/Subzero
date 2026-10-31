/**
 * Static catalog data for the seed. Money is integer paise, percentages are
 * basis points. Rows reference each other by `key`; generate.ts swaps keys for
 * UUIDs.
 */

import type { Interval } from "../../lib/dates";
import type { YmdString } from "./rng";

export interface TaxFixture {
  key: string;
  name: string;
  rateBps: number;
}

export const taxes: readonly TaxFixture[] = [
  { key: "gst18", name: "GST 18%", rateBps: 1800 },
  { key: "gst12", name: "GST 12%", rateBps: 1200 },
  { key: "gst5", name: "GST 5%", rateBps: 500 },
  { key: "exempt", name: "Exempt", rateBps: 0 },
];

export interface PaymentTermFixture {
  key: string;
  name: string;
  dueDays: number;
}

export const paymentTerms: readonly PaymentTermFixture[] = [
  { key: "immediate", name: "Immediate", dueDays: 0 },
  { key: "net15", name: "15 days", dueDays: 15 },
  { key: "net30", name: "30 days", dueDays: 30 },
];

export interface VariantFixture {
  attribute: string;
  value: string;
  extraPrice: number;
  /** Relative pick weight when generating subscription lines. */
  weight: number;
}

export interface ProductFixture {
  key: string;
  name: string;
  salesPrice: number;
  costPrice: number;
  taxKey: string;
  /** Max quantity on a generated subscription line (default 3). */
  qtyMax?: number;
  variants?: readonly VariantFixture[];
}

export const products: readonly ProductFixture[] = [
  {
    key: "erp",
    name: "Brightloop ERP",
    salesPrice: 499900,
    costPrice: 220000,
    taxKey: "gst18",
    variants: [
      { attribute: "Brand", value: "Odoo", extraPrice: 56000, weight: 40 },
      { attribute: "Brand", value: "Generic", extraPrice: 0, weight: 60 },
    ],
  },
  { key: "crm", name: "Brightloop CRM", salesPrice: 249900, costPrice: 110000, taxKey: "gst18" },
  { key: "billing", name: "Brightloop Billing Suite", salesPrice: 199900, costPrice: 80000, taxKey: "gst18" },
  { key: "hr", name: "Brightloop HR & Payroll", salesPrice: 179900, costPrice: 70000, taxKey: "gst18" },
  { key: "inventory", name: "Brightloop Inventory", salesPrice: 149900, costPrice: 60000, taxKey: "gst18" },
  { key: "pos", name: "Brightloop POS", salesPrice: 99900, costPrice: 40000, taxKey: "gst18" },
  { key: "gst-filing", name: "GST Filing Assistant", salesPrice: 59900, costPrice: 20000, taxKey: "gst18" },
  { key: "e-invoice", name: "E-Invoice Connector", salesPrice: 39900, costPrice: 12000, taxKey: "gst18" },
  { key: "whatsapp", name: "WhatsApp Business API Add-on", salesPrice: 29900, costPrice: 14000, taxKey: "gst18" },
  { key: "seat", name: "Extra User Seat", salesPrice: 9900, costPrice: 3000, taxKey: "gst18", qtyMax: 25 },
  { key: "support", name: "Priority Support (24x7)", salesPrice: 79900, costPrice: 35000, taxKey: "gst18" },
  { key: "onboarding", name: "Onboarding & Training", salesPrice: 250000, costPrice: 120000, taxKey: "gst18" },
  { key: "migration", name: "Data Migration Service", salesPrice: 150000, costPrice: 70000, taxKey: "gst18" },
  { key: "storage", name: "Cloud Storage 100 GB", salesPrice: 19900, costPrice: 8000, taxKey: "gst18", qtyMax: 5 },
  { key: "domain", name: "Custom Domain & SSL", salesPrice: 14900, costPrice: 5000, taxKey: "gst18" },
  { key: "analytics", name: "Advanced Analytics Pack", salesPrice: 89900, costPrice: 30000, taxKey: "gst18" },
  { key: "mobile", name: "Mobile App Add-on", salesPrice: 49900, costPrice: 20000, taxKey: "gst18" },
  { key: "biometric", name: "Biometric Attendance Integration", salesPrice: 34900, costPrice: 15000, taxKey: "gst12" },
  { key: "manual", name: "Printed User Manual Kit", salesPrice: 4900, costPrice: 2500, taxKey: "gst5" },
  { key: "webinar", name: "Training Webinar Pass", salesPrice: 9900, costPrice: 1000, taxKey: "exempt" },
];

export interface PlanFixture {
  key: string;
  name: string;
  /** Plan fee in paise (informational; line prices drive invoice totals). */
  price: number;
  interval: Interval;
  intervalCount: number;
  minQty: number;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  autoClose: boolean;
  /** Relative weight when assigning a plan to a generated subscription. */
  weight: number;
}

export const plans: readonly PlanFixture[] = [
  { key: "daily-pass", name: "Daily Pass", price: 0, interval: "daily", intervalCount: 1, minQty: 1, closable: true, pausable: false, renewable: false, autoClose: true, weight: 3 },
  { key: "weekly-starter", name: "Weekly Starter", price: 0, interval: "weekly", intervalCount: 1, minQty: 1, closable: true, pausable: true, renewable: false, autoClose: false, weight: 5 },
  { key: "monthly-basic", name: "Monthly Basic", price: 0, interval: "monthly", intervalCount: 1, minQty: 1, closable: true, pausable: false, renewable: true, autoClose: false, weight: 25 },
  { key: "monthly-pro", name: "Monthly Pro", price: 49900, interval: "monthly", intervalCount: 1, minQty: 1, closable: true, pausable: true, renewable: true, autoClose: false, weight: 22 },
  { key: "monthly-flex", name: "Monthly Flexible", price: 0, interval: "monthly", intervalCount: 1, minQty: 1, closable: true, pausable: true, renewable: false, autoClose: false, weight: 15 },
  { key: "quarterly-business", name: "Quarterly Business", price: 99900, interval: "monthly", intervalCount: 3, minQty: 1, closable: false, pausable: true, renewable: true, autoClose: false, weight: 8 },
  { key: "yearly-standard", name: "Yearly Standard", price: 0, interval: "yearly", intervalCount: 1, minQty: 1, closable: true, pausable: true, renewable: true, autoClose: false, weight: 14 },
  { key: "yearly-locked", name: "Yearly Committed", price: 199900, interval: "yearly", intervalCount: 1, minQty: 5, closable: false, pausable: false, renewable: true, autoClose: true, weight: 8 },
];

export interface TemplateLineFixture {
  productKey: string;
  variantValue?: string;
  qty: number;
}

export interface TemplateFixture {
  key: string;
  name: string;
  validityDays: number;
  planKey: string;
  paymentTermKey: string;
  lines: readonly TemplateLineFixture[];
}

export const quotationTemplates: readonly TemplateFixture[] = [
  {
    key: "tpl-starter",
    name: "SMB Starter Bundle",
    validityDays: 15,
    planKey: "monthly-basic",
    paymentTermKey: "net15",
    lines: [
      { productKey: "billing", qty: 1 },
      { productKey: "gst-filing", qty: 1 },
      { productKey: "seat", qty: 5 },
    ],
  },
  {
    key: "tpl-erp-odoo",
    name: "ERP Annual (Odoo brand)",
    validityDays: 30,
    planKey: "yearly-standard",
    paymentTermKey: "net30",
    lines: [
      { productKey: "erp", variantValue: "Odoo", qty: 1 },
      { productKey: "onboarding", qty: 1 },
      { productKey: "support", qty: 1 },
    ],
  },
  {
    key: "tpl-retail",
    name: "Retail Growth Pack",
    validityDays: 15,
    planKey: "monthly-pro",
    paymentTermKey: "immediate",
    lines: [
      { productKey: "pos", qty: 2 },
      { productKey: "inventory", qty: 1 },
      { productKey: "whatsapp", qty: 1 },
    ],
  },
  {
    key: "tpl-enterprise",
    name: "Enterprise Quarterly Suite",
    validityDays: 30,
    planKey: "quarterly-business",
    paymentTermKey: "net30",
    lines: [
      { productKey: "erp", variantValue: "Generic", qty: 1 },
      { productKey: "crm", qty: 1 },
      { productKey: "hr", qty: 1 },
      { productKey: "analytics", qty: 1 },
    ],
  },
];

export interface DiscountFixture {
  code: string;
  name: string;
  kind: "percent" | "fixed";
  /** bps when percent, paise when fixed. */
  value: number;
  scope: "subscription" | "products";
  productKey?: string;
  startsOn: YmdString;
  endsOn: YmdString | null;
  usageLimit: number | null;
  usedCount: number;
}

export const discounts: readonly DiscountFixture[] = [
  { code: "WELCOME10", name: "Welcome 10% off", kind: "percent", value: 1000, scope: "subscription", startsOn: "2025-01-01", endsOn: null, usageLimit: null, usedCount: 212 },
  { code: "EARLYBIRD15", name: "Early bird 15% (expired)", kind: "percent", value: 1500, scope: "subscription", startsOn: "2025-04-01", endsOn: "2026-03-31", usageLimit: null, usedCount: 88 },
  { code: "LAUNCH500", name: "Launch flat Rs 500 (used up)", kind: "fixed", value: 50000, scope: "subscription", startsOn: "2025-06-01", endsOn: "2027-06-01", usageLimit: 100, usedCount: 100 },
  { code: "ERP25", name: "ERP 25% off", kind: "percent", value: 2500, scope: "products", productKey: "erp", startsOn: "2026-01-01", endsOn: "2027-03-31", usageLimit: 500, usedCount: 41 },
  { code: "SUPPORT200", name: "Priority Support Rs 200 off", kind: "fixed", value: 20000, scope: "products", productKey: "support", startsOn: "2026-04-01", endsOn: null, usageLimit: 250, usedCount: 17 },
  { code: "DIWALI20", name: "Diwali 20% off", kind: "percent", value: 2000, scope: "subscription", startsOn: "2026-10-15", endsOn: "2026-11-15", usageLimit: 300, usedCount: 23 },
];

// ---------------------------------------------------------------------------
// People and places
// ---------------------------------------------------------------------------

export const firstNames: readonly string[] = [
  "Aarav", "Vivaan", "Aditya", "Arjun", "Rohan", "Karan", "Rahul", "Amit", "Suresh", "Rajesh",
  "Vikram", "Manish", "Nikhil", "Sanjay", "Deepak", "Anil", "Pradeep", "Harish", "Imran", "Faisal",
  "Ananya", "Priya", "Neha", "Pooja", "Kavita", "Sneha", "Divya", "Meera", "Lakshmi", "Sunita",
  "Anjali", "Shreya", "Ritu", "Swati", "Nandini", "Fatima", "Ayesha", "Gurpreet", "Harpreet", "Ishita",
];

export const lastNames: readonly string[] = [
  "Sharma", "Verma", "Gupta", "Agarwal", "Iyer", "Nair", "Menon", "Reddy", "Naidu", "Rao",
  "Patel", "Shah", "Mehta", "Desai", "Joshi", "Kulkarni", "Deshmukh", "Patil", "Chatterjee", "Banerjee",
  "Mukherjee", "Das", "Singh", "Kaur", "Malhotra", "Kapoor", "Khanna", "Bhatia", "Chopra", "Khan",
  "Ansari", "Qureshi", "Pillai", "Krishnan", "Subramanian", "Hegde", "Shetty", "Bose", "Sen", "Thakur",
];

export const companyWords: readonly string[] = [
  "Textiles", "Traders", "Logistics", "Foods", "Pharma", "Electricals", "Infotech", "Solutions", "Agro",
  "Constructions", "Packaging", "Exports", "Retail", "Motors", "Printers", "Hospitality", "Diagnostics",
  "Steel", "Plastics", "Consultancy", "Studios", "Fabrics", "Enterprises", "Labs", "Networks",
];

export const companySuffixes: readonly string[] = ["Pvt Ltd", "LLP", "& Co.", "Industries", "Enterprises", "Ltd"];

export interface CityFixture {
  city: string;
  state: string;
  pincode: string;
}

export const cities: readonly CityFixture[] = [
  { city: "Mumbai", state: "Maharashtra", pincode: "400001" },
  { city: "Pune", state: "Maharashtra", pincode: "411001" },
  { city: "Nagpur", state: "Maharashtra", pincode: "440001" },
  { city: "Bengaluru", state: "Karnataka", pincode: "560001" },
  { city: "Mysuru", state: "Karnataka", pincode: "570001" },
  { city: "Chennai", state: "Tamil Nadu", pincode: "600001" },
  { city: "Coimbatore", state: "Tamil Nadu", pincode: "641001" },
  { city: "Hyderabad", state: "Telangana", pincode: "500001" },
  { city: "Kochi", state: "Kerala", pincode: "682001" },
  { city: "Ahmedabad", state: "Gujarat", pincode: "380001" },
  { city: "Surat", state: "Gujarat", pincode: "395001" },
  { city: "Jaipur", state: "Rajasthan", pincode: "302001" },
  { city: "New Delhi", state: "Delhi", pincode: "110001" },
  { city: "Gurugram", state: "Haryana", pincode: "122001" },
  { city: "Noida", state: "Uttar Pradesh", pincode: "201301" },
  { city: "Lucknow", state: "Uttar Pradesh", pincode: "226001" },
  { city: "Kolkata", state: "West Bengal", pincode: "700001" },
  { city: "Bhubaneswar", state: "Odisha", pincode: "751001" },
  { city: "Indore", state: "Madhya Pradesh", pincode: "452001" },
  { city: "Chandigarh", state: "Chandigarh", pincode: "160001" },
];
