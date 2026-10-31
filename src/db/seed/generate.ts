/**
 * Pure dataset generator for the seed. No DB access: returns plain row objects
 * keyed by UUIDs derived from the seeded PRNG, so the same input always yields
 * the same output. The DB layer batches these into inserts and later builds
 * invoices/payments from `billingPeriods`.
 */

import {
  companySuffixes,
  companyWords,
  discounts as discountFixtures,
  firstNames,
  lastNames,
  cities,
  paymentTerms as paymentTermFixtures,
  plans as planFixtures,
  products as productFixtures,
  quotationTemplates as templateFixtures,
  taxes as taxFixtures,
  type PlanFixture,
  type ProductFixture,
  type VariantFixture,
} from "./fixtures";
import { addDays, addInterval } from "../../lib/dates";
import { createRng, type Rng, type YmdString } from "./rng";

const addMonths = (s: YmdString, months: number) => addInterval(s, "monthly", months);

export type SubscriptionStatus = "draft" | "quotation" | "confirmed" | "active" | "paused" | "closed";

export interface DatasetOptions {
  seed: number;
  today: YmdString;
  customers: number;
  subscriptions: number;
  /** Subscriptions with next_invoice_date = today (billing-run demo). Default 14. */
  dueToday?: number;
}

export interface TaxRow { id: string; name: string; rateBps: number }
export interface PaymentTermRow { id: string; name: string; dueDays: number }
export interface ProductRow { id: string; name: string; salesPrice: number; costPrice: number; taxId: string }
export interface VariantRow { id: string; productId: string; attribute: string; value: string; extraPrice: number }
export interface PlanRow {
  id: string; name: string; price: number; interval: PlanFixture["interval"]; intervalCount: number;
  minQty: number; closable: boolean; pausable: boolean; renewable: boolean; autoClose: boolean;
}
export interface TemplateRow {
  id: string; name: string; validityDays: number; planId: string; paymentTermId: string;
  lines: { productId: string; variantId: string | null; qty: number }[];
}
export interface DiscountRow {
  id: string; code: string; name: string; kind: "percent" | "fixed"; value: number;
  scope: "subscription" | "products"; productId: string | null;
  startsOn: YmdString | null; endsOn: YmdString | null; usageLimit: number | null; usedCount: number;
}
export interface CustomerRow {
  id: string; name: string; company: string; email: string; phone: string;
  city: string; state: string; pincode: string; gstin: string;
  /** 1..5 for the portal demo customers (customerN@brightloop.test), otherwise null. */
  portalIndex: number | null;
}
export interface SubscriptionRow {
  id: string; number: string; customerId: string; planId: string; status: SubscriptionStatus;
  startDate: YmdString; expiryDate: YmdString | null; nextInvoiceDate: YmdString | null;
  paymentTermId: string; quotationValidUntil: YmdString | null; templateId: string | null;
}
export interface SubscriptionLineRow {
  id: string; subscriptionId: string; productId: string; variantId: string | null; qty: number; unitPrice: number;
}
/** One period to invoice later. periodEnd is inclusive. */
export interface BillingPeriod {
  subscriptionId: string; index: number; periodStart: YmdString; periodEnd: YmdString;
}
/** One activity_log row per transition (the first status, draft, has no row). */
export interface StatusTransition {
  subscriptionId: string; from: SubscriptionStatus; to: SubscriptionStatus; at: YmdString;
}

export interface Dataset {
  seed: number;
  today: YmdString;
  taxes: TaxRow[];
  paymentTerms: PaymentTermRow[];
  products: ProductRow[];
  variants: VariantRow[];
  plans: PlanRow[];
  templates: TemplateRow[];
  discounts: DiscountRow[];
  customers: CustomerRow[];
  subscriptions: SubscriptionRow[];
  subscriptionLines: SubscriptionLineRow[];
  billingPeriods: BillingPeriod[];
  statusHistory: StatusTransition[];
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`seed: missing ${what}`);
  return value;
}

/** Start of the periods: period i begins at start + i * count units (anchored, so no month-end drift). */
function periodStart(start: YmdString, plan: PlanFixture, i: number): YmdString {
  return addInterval(start, plan.interval, plan.intervalCount * i);
}

function periodsBefore(subscriptionId: string, start: YmdString, plan: PlanFixture, cutoff: YmdString) {
  const periods: BillingPeriod[] = [];
  let i = 0;
  for (;;) {
    const s = periodStart(start, plan, i);
    if (s >= cutoff) return { periods, next: s };
    periods.push({ subscriptionId, index: i, periodStart: s, periodEnd: addDays(periodStart(start, plan, i + 1), -1) });
    i++;
  }
}

/** How far back (in days) a new subscription of this plan may start. */
function startRange(plan: PlanFixture, windowStart: YmdString, today: YmdString): [YmdString, YmdString] {
  const latest = addDays(today, -3);
  const maxBack = plan.interval === "daily" ? 30 : plan.interval === "weekly" ? 180 : Infinity;
  const earliest = maxBack === Infinity ? windowStart : addDays(today, -maxBack);
  return [earliest > windowStart ? earliest : windowStart, latest];
}

export function generateDataset(opts: DatasetOptions): Dataset {
  const { seed, today } = opts;
  const dueTarget = opts.dueToday ?? 14;
  const rng = createRng(seed);
  const idRng = createRng(seed ^ 0x9e3779b9); // separate stream so ids never shift row content
  const id = () => idRng.uuid();
  const windowStart = addMonths(today, -18);

  // --- catalog ----------------------------------------------------------
  const taxes: TaxRow[] = taxFixtures.map((t) => ({ id: id(), name: t.name, rateBps: t.rateBps }));
  const taxIdByKey = new Map(taxFixtures.map((t, i) => [t.key, (taxes[i] as TaxRow).id]));
  const paymentTerms: PaymentTermRow[] = paymentTermFixtures.map((p) => ({ id: id(), name: p.name, dueDays: p.dueDays }));
  const termIdByKey = new Map(paymentTermFixtures.map((p, i) => [p.key, (paymentTerms[i] as PaymentTermRow).id]));

  const products: ProductRow[] = [];
  const variants: VariantRow[] = [];
  const variantsByProduct = new Map<string, { row: VariantRow; fx: VariantFixture }[]>();
  const productFxById = new Map<string, ProductFixture>();
  const productIdByKey = new Map<string, string>();
  for (const p of productFixtures) {
    const row: ProductRow = {
      id: id(), name: p.name, salesPrice: p.salesPrice, costPrice: p.costPrice,
      taxId: need(taxIdByKey.get(p.taxKey), `tax ${p.taxKey}`),
    };
    products.push(row);
    productFxById.set(row.id, p);
    productIdByKey.set(p.key, row.id);
    for (const v of p.variants ?? []) {
      const vr: VariantRow = { id: id(), productId: row.id, attribute: v.attribute, value: v.value, extraPrice: v.extraPrice };
      variants.push(vr);
      const list = variantsByProduct.get(row.id) ?? [];
      list.push({ row: vr, fx: v });
      variantsByProduct.set(row.id, list);
    }
  }

  const plans: PlanRow[] = planFixtures.map((p) => ({
    id: id(), name: p.name, price: p.price, interval: p.interval, intervalCount: p.intervalCount, minQty: p.minQty,
    closable: p.closable, pausable: p.pausable, renewable: p.renewable, autoClose: p.autoClose,
  }));
  const planIdByKey = new Map(planFixtures.map((p, i) => [p.key, (plans[i] as PlanRow).id]));
  const planFxById = new Map(planFixtures.map((p, i) => [(plans[i] as PlanRow).id, p]));

  const templates: TemplateRow[] = templateFixtures.map((t) => ({
    id: id(), name: t.name, validityDays: t.validityDays,
    planId: need(planIdByKey.get(t.planKey), `plan ${t.planKey}`),
    paymentTermId: need(termIdByKey.get(t.paymentTermKey), `term ${t.paymentTermKey}`),
    lines: t.lines.map((l) => {
      const productId = need(productIdByKey.get(l.productKey), `product ${l.productKey}`);
      const variant = l.variantValue
        ? need(variantsByProduct.get(productId)?.find((v) => v.row.value === l.variantValue), `variant ${l.variantValue}`).row
        : undefined;
      return { productId, variantId: variant?.id ?? null, qty: l.qty };
    }),
  }));

  const discounts: DiscountRow[] = discountFixtures.map((d) => ({
    id: id(), code: d.code, name: d.name, kind: d.kind, value: d.value, scope: d.scope,
    productId: d.productKey ? need(productIdByKey.get(d.productKey), `product ${d.productKey}`) : null,
    startsOn: d.startsOn, endsOn: d.endsOn, usageLimit: d.usageLimit, usedCount: d.usedCount,
  }));

  // --- customers --------------------------------------------------------
  const customers: CustomerRow[] = [];
  for (let i = 0; i < opts.customers; i++) {
    const first = rng.pick(firstNames);
    const last = rng.pick(lastNames);
    const place = rng.pick(cities);
    const portalIndex = i < 5 ? i + 1 : null;
    const company = `${last} ${rng.pick(companyWords)} ${rng.pick(companySuffixes)}`;
    customers.push({
      id: id(),
      name: `${first} ${last}`,
      company,
      email: portalIndex ? `customer${portalIndex}@brightloop.test` : `${first}.${last}${i + 1}@example.in`.toLowerCase(),
      phone: `+91 ${rng.int(7, 9)}${pad(rng.int(0, 999_999_999), 9)}`,
      city: place.city,
      state: place.state,
      pincode: place.pincode,
      gstin: `${pad(rng.int(1, 37), 2)}${String.fromCharCode(65 + rng.int(0, 25), 65 + rng.int(0, 25), 65 + rng.int(0, 25), 65 + rng.int(0, 25), 65 + rng.int(0, 25))}${pad(rng.int(0, 9999), 4)}${String.fromCharCode(65 + rng.int(0, 25))}1Z${rng.int(0, 9)}`,
      portalIndex,
    });
  }

  // --- subscriptions ----------------------------------------------------
  const n = opts.subscriptions;
  const counts: Record<SubscriptionStatus, number> = {
    active: Math.round(n * 0.7),
    paused: Math.round(n * 0.08),
    closed: Math.round(n * 0.1),
    draft: 0, quotation: 0, confirmed: 0,
  };
  const rest = n - counts.active - counts.paused - counts.closed;
  counts.draft = Math.floor(rest / 3);
  counts.quotation = Math.floor(rest / 3);
  counts.confirmed = rest - counts.draft - counts.quotation;

  const statuses: SubscriptionStatus[] = [];
  for (const [status, count] of Object.entries(counts) as [SubscriptionStatus, number][]) {
    for (let i = 0; i < count; i++) statuses.push(status);
  }
  const shuffledStatuses = rng.shuffle(statuses);

  type Draft = { sub: Omit<SubscriptionRow, "number">; lines: SubscriptionLineRow[]; periods: BillingPeriod[]; history: StatusTransition[] };
  const drafts: Draft[] = [];

  const planPool = (filter: (p: PlanFixture) => boolean) =>
    plans.filter((p) => filter(need(planFxById.get(p.id), "plan"))).map((p) => ({ value: p, weight: need(planFxById.get(p.id), "plan").weight }));
  const pickPlan = (filter: (p: PlanFixture) => boolean = () => true): PlanRow => rng.weighted(planPool(filter));

  let dueAssigned = 0;
  let portalAssigned = 0;

  for (const status of shuffledStatuses) {
    const subId = id();
    let customerId = (rng.pick(customers)).id;
    let plan: PlanRow;
    let planFx: PlanFixture;
    let start: YmdString;
    let periods: BillingPeriod[] = [];
    let next: YmdString | null = null;
    const history: StatusTransition[] = [];
    let quotationValidUntil: YmdString | null = null;
    const templateId = rng.chance(0.3) ? rng.pick(templates).id : null;

    const setPlan = (p: PlanRow) => { plan = p; planFx = need(planFxById.get(p.id), "plan"); };
    const trans = (from: SubscriptionStatus, to: SubscriptionStatus, at: YmdString) =>
      history.push({ subscriptionId: subId, from, to, at });

    if (status === "active" || status === "paused" || status === "closed") {
      const isDue = status === "active" && dueAssigned < dueTarget;
      const isPortal = status === "active" && !isDue && portalAssigned < 15;
      if (isPortal) {
        customerId = (customers[portalAssigned % 5] as CustomerRow).id;
        // first five portal subscriptions use a pausable plan so the portal demo can pause one
        setPlan(portalAssigned < 5 ? pickPlan((p) => p.pausable) : pickPlan());
        portalAssigned++;
      } else if (status === "paused") setPlan(pickPlan((p) => p.pausable));
      else if (status === "closed") setPlan(pickPlan((p) => p.closable || p.autoClose));
      else setPlan(pickPlan());

      if (isDue) {
        // find a start date whose k-th period begins exactly today
        let found: YmdString | null = null;
        for (let attempts = 0; attempts < 20 && !found; attempts++) {
          if (attempts > 0) setPlan(pickPlan());
          const maxK = planFx!.interval === "daily" ? 30 : planFx!.interval === "weekly" ? 26
            : Math.floor(18 / (planFx!.intervalCount * (planFx!.interval === "yearly" ? 12 : 1)));
          if (maxK < 1) continue;
          for (let k = rng.int(1, maxK); k <= maxK + 3 && !found; k++) {
            const cand = addInterval(today, planFx!.interval, -planFx!.intervalCount * k);
            if (cand >= windowStart && addInterval(cand, planFx!.interval, planFx!.intervalCount * k) === today) found = cand;
          }
        }
        if (!found) throw new Error("seed: could not place a due-today subscription");
        start = found;
        dueAssigned++;
      } else {
        const [from, to] = startRange(planFx!, windowStart, today);
        start = rng.date(from, to);
      }

      if (status === "active") {
        let res = periodsBefore(subId, start, planFx!, today);
        // only the designated subs may be due today
        while (!isDue && res.next === today) {
          start = addDays(start, 1);
          res = periodsBefore(subId, start, planFx!, today);
        }
        periods = res.periods;
        next = res.next;
      } else {
        const at = rng.date(addDays(start, 1), addDays(today, -1));
        const res = periodsBefore(subId, start, planFx!, at);
        periods = res.periods;
        next = status === "paused" ? res.next : null;
        trans("active", status, at);
      }
      // pre-activation steps
      const confirmedAt = addDays(start, -rng.int(1, 5));
      const quotationAt = addDays(confirmedAt, -rng.int(1, 3));
      history.unshift(
        { subscriptionId: subId, from: "draft", to: "quotation", at: quotationAt },
        { subscriptionId: subId, from: "quotation", to: "confirmed", at: confirmedAt },
        { subscriptionId: subId, from: "confirmed", to: "active", at: start },
      );
    } else {
      setPlan(pickPlan());
      if (status === "confirmed") {
        const confirmedAt = addDays(today, -rng.int(0, 10));
        start = addDays(today, rng.int(1, 30));
        next = start;
        trans("draft", "quotation", addDays(confirmedAt, -rng.int(1, 3)));
        trans("quotation", "confirmed", confirmedAt);
      } else if (status === "quotation") {
        const quotationAt = addDays(today, -rng.int(0, 40));
        start = addDays(quotationAt, rng.int(5, 40));
        quotationValidUntil = addDays(quotationAt, rng.pick([15, 30]));
        trans("draft", "quotation", quotationAt);
      } else {
        start = addDays(today, rng.int(-5, 45));
      }
    }

    const expiryDate = status !== "closed" && rng.chance(0.25) ? addDays(today, rng.int(30, 400)) : null;

    // lines
    const lineCount = rng.weighted([{ value: 1, weight: 35 }, { value: 2, weight: 35 }, { value: 3, weight: 20 }, { value: 4, weight: 10 }]);
    const lines: SubscriptionLineRow[] = rng.shuffle(products).slice(0, lineCount).map((p) => {
      const fx = need(productFxById.get(p.id), "product");
      const vs = variantsByProduct.get(p.id);
      const variant = vs ? rng.weighted(vs.map((v) => ({ value: v.row, weight: v.fx.weight }))) : null;
      return {
        id: id(), subscriptionId: subId, productId: p.id, variantId: variant?.id ?? null,
        qty: rng.int(Math.max(1, planFx!.minQty), Math.max(planFx!.minQty, fx.qtyMax ?? 3)),
        unitPrice: p.salesPrice + (variant?.extraPrice ?? 0),
      };
    });

    drafts.push({
      sub: {
        id: subId, customerId, planId: plan!.id, status, startDate: start!, expiryDate, nextInvoiceDate: next,
        paymentTermId: rng.pick(paymentTerms).id, quotationValidUntil, templateId,
      },
      lines, periods, history,
    });
  }

  // number subscriptions in start-date order (stable)
  const order = drafts.map((d, i) => ({ d, i })).sort((a, b) => (a.d.sub.startDate < b.d.sub.startDate ? -1 : a.d.sub.startDate > b.d.sub.startDate ? 1 : a.i - b.i));
  const subscriptions: SubscriptionRow[] = [];
  const subscriptionLines: SubscriptionLineRow[] = [];
  const billingPeriods: BillingPeriod[] = [];
  const statusHistory: StatusTransition[] = [];
  order.forEach(({ d }, idx) => {
    subscriptions.push({ ...d.sub, number: `SUB-${pad(idx + 1, 4)}` });
    subscriptionLines.push(...d.lines);
    billingPeriods.push(...d.periods);
    statusHistory.push(...d.history);
  });

  return {
    seed, today, taxes, paymentTerms, products, variants, plans, templates, discounts,
    customers, subscriptions, subscriptionLines, billingPeriods, statusHistory,
  };
}

// re-exported for callers that only import the generator
export type { Rng };
