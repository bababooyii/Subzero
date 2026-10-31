"use client";

import { Check, FilePlus2, LayoutTemplate, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/helpers/classname-helper";
import { TaxPicker } from "@/components/catalog/TaxPicker";
import { Dropdown } from "@/components/ui/Dropdown";
import { Field, Input } from "@/components/ui/Field";
import { Intro } from "@/components/ui/Intro";
import { PageGrid } from "@/components/ui/PageGrid";
import { ScrollPanel } from "@/components/ui/ScrollPanel";
import { toast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import { priceLines } from "@/lib/mock/pricing";
import type { NewSubscriptionData } from "@/lib/mock/selectors-subscriptions";
import { btnSecondary, btnSquare, sectionTitle, surface } from "@/lib/ui";
import { INTERVAL_LABEL, addDaysISO, addMonthsISO } from "./labels";
import { PrimaryDynamicButton } from "./PrimaryDynamicButton";

type Data = NewSubscriptionData;
type DraftLine = { key: number; productId: string; variant: string; qty: number; taxId: string };
type SendState = "idle" | "saving" | "sent";

let keySeq = 0;
const nextKey = () => ++keySeq;

const TERMS = ["Immediate", "Net 15", "Net 30"];
/** Layout follows the form's width (container query), not the viewport: the left column eats space at lg. */
const lineGrid = "grid grid-cols-[64px_minmax(0,1fr)_32px] items-center gap-2 @2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_112px_64px_84px_92px_32px]";

/** Price per period for a product + variant on a plan, in paise (rounded to whole rupees like the seed data). */
function unitPrice(data: Data, productId: string, variant: string, factor: number): number {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return 0;
  const extra = product.variants.find((v) => v.label === variant)?.extraPrice ?? 0;
  return Math.round(((product.salesPrice + extra) * factor) / 100) * 100;
}

function defaultVariant(data: Data, productId: string): string {
  return data.products.find((p) => p.id === productId)?.variants[0]?.label ?? "";
}

const DEFAULT_TAX_ID = "tax-gst18";

function defaultTax(data: Data, productId: string): string {
  const id = data.products.find((p) => p.id === productId)?.taxId;
  return id && data.taxes.some((t) => t.id === id) ? id : DEFAULT_TAX_ID;
}

type Props = { data: Data; initialCustomerId?: string; initialTemplateId?: string };

/** Quotation builder with a live totals block. Nothing is persisted. */
export function NewSubscriptionForm({ data, initialCustomerId, initialTemplateId }: Props) {
  const router = useRouter();
  const defaultPlan = data.plans.find((p) => p.id === "pln-03") ?? data.plans[0];
  const initialTemplate = data.templates.find((t) => t.id === initialTemplateId);

  const makeLines = (templateId: string | null, plan: Data["plans"][number]): DraftLine[] => {
    const t = data.templates.find((x) => x.id === templateId);
    const src = t ? t.lines : [{ productId: data.products[0].id, qty: 1 }];
    return src.map((l) => ({ key: nextKey(), productId: l.productId, variant: defaultVariant(data, l.productId), qty: Math.max(l.qty, plan.minQty), taxId: defaultTax(data, l.productId) }));
  };

  const [templateId, setTemplateId] = useState<string | null>(initialTemplate?.id ?? null);
  const [customerId, setCustomerId] = useState(data.customers.some((c) => c.id === initialCustomerId) ? (initialCustomerId as string) : "");
  const [planId, setPlanId] = useState(initialTemplate?.planId ?? defaultPlan.id);
  const [start, setStart] = useState(data.today);
  const [expiryOverride, setExpiryOverride] = useState<string | null>(null);
  const [terms, setTerms] = useState("Net 15");
  const [discountId, setDiscountId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => makeLines(initialTemplate?.id ?? null, initialTemplate ? (data.plans.find((p) => p.id === initialTemplate.planId) ?? defaultPlan) : defaultPlan));
  const [taxes, setTaxes] = useState(data.taxes);
  const [send, setSend] = useState<SendState>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const plan = data.plans.find((p) => p.id === planId) ?? defaultPlan;
  const computedExpiry = addMonthsISO(start, plan.interval === "yearly" ? 24 : 12);
  const expiry = expiryOverride ?? computedExpiry;

  const priced = useMemo(
    () =>
      lines.map((l) => ({
        ...l,
        unit: unitPrice(data, l.productId, l.variant, plan.factor),
      })),
    [lines, data, plan.factor],
  );

  // The chosen discount is attached to the lines it applies to, then priceLines does the maths.
  const pricedLines = useMemo(() => {
    const d = data.discounts.find((x) => x.id === discountId);
    const gross = priced.reduce((n, l) => n + l.qty * l.unit, 0);
    const eligible = new Set<number>();
    if (d && gross >= d.minPurchase) {
      if (d.scope === "products") {
        for (const l of priced) if (d.targetIds.includes(l.productId) && l.qty >= d.minQty) eligible.add(l.key);
      } else if (d.type === "fixed") {
        if (priced[0]) eligible.add(priced[0].key);
      } else {
        for (const l of priced) eligible.add(l.key);
      }
    }
    return priced.map((l) => ({ qty: l.qty, unitPrice: l.unit, taxId: l.taxId, discountId: eligible.has(l.key) ? d?.id : undefined }));
  }, [priced, discountId, data.discounts]);

  const totals = priceLines(pricedLines, taxes, data.discounts);
  const discount = data.discounts.find((d) => d.id === discountId);
  const discountApplies = !discount || totals.discountTotal > 0;

  const badQty = lines.some((l) => !Number.isInteger(l.qty) || l.qty < plan.minQty);
  const problems = [
    !customerId && "Choose a customer",
    lines.length === 0 && "Add at least one line",
    badQty && `Quantity must be at least ${plan.minQty}`,
  ].filter(Boolean) as string[];
  const valid = problems.length === 0;
  const customerName = data.customers.find((c) => c.id === customerId)?.name ?? "customer";

  const patchLine = (key: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const applyTemplate = (id: string | null) => {
    const t = data.templates.find((x) => x.id === id);
    const nextPlan = t ? (data.plans.find((p) => p.id === t.planId) ?? plan) : plan;
    setTemplateId(id);
    setPlanId(nextPlan.id);
    setExpiryOverride(null);
    setLines(makeLines(id, nextPlan));
    toast(t ? `Loaded “${t.name}”` : "Started a blank quotation");
  };

  const changePlan = (id: string) => {
    const next = data.plans.find((p) => p.id === id);
    if (!next) return;
    setPlanId(id);
    setExpiryOverride(null);
    setLines((ls) => ls.map((l) => ({ ...l, qty: Math.max(l.qty, next.minQty) })));
  };

  const saveDraft = () => toast(`Draft saved for ${customerName}`);

  const sendQuotation = () => {
    if (!valid || send !== "idle") return;
    setSend("saving");
    timers.current.push(
      setTimeout(() => {
        setSend("sent");
        toast(`Quotation sent to ${customerName}`);
        timers.current.push(setTimeout(() => router.push("/subscriptions?view=quotation"), 900));
      }, 800),
    );
  };

  const planUnit = plan.interval === "daily" ? "day" : plan.interval === "weekly" ? "week" : plan.interval === "monthly" ? "month" : "year";

  return (
    <PageGrid
      left={<Intro icon={<FilePlus2 />} title="New subscription" subtitle="Build a quotation with a live total." />}
    >
      <form
        className="@container flex h-full min-h-0 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          sendQuotation();
        }}
      >
        <section aria-label="Start from template" className="grid shrink-0 grid-cols-2 gap-2.5 @3xl:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          <button
            type="button"
            aria-pressed={templateId === null}
            onClick={() => applyTemplate(null)}
            className={cn(surface, "flex min-w-0 cursor-pointer flex-col items-start gap-0.5 px-3.5 py-2.5 text-left outline-none hover:bg-white/[0.045] focus-visible:outline-2 focus-visible:outline-accent", templateId === null && "border-white/20 bg-white/[0.05]")}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-text">
              <Plus size={13} /> Blank
            </span>
            <span className="text-[12px] text-muted">Start with one empty line</span>
          </button>
          {data.templates.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={templateId === t.id}
              onClick={() => applyTemplate(t.id)}
              className={cn(surface, "flex min-w-0 cursor-pointer flex-col items-start gap-0.5 px-3.5 py-2.5 text-left outline-none hover:bg-white/[0.045] focus-visible:outline-2 focus-visible:outline-accent", templateId === t.id && "border-white/20 bg-white/[0.05]")}
            >
              <span className="flex max-w-full items-center gap-1.5 text-[13px] font-medium text-text">
                <LayoutTemplate size={13} className="shrink-0" /> <span className="truncate">{t.name}</span>
              </span>
              <span className="max-w-full truncate text-[12px] text-muted">
                {data.plans.find((p) => p.id === t.planId)?.name} · {t.lines.length} {t.lines.length === 1 ? "line" : "lines"} · valid {t.validityDays} days
              </span>
            </button>
          ))}
        </section>

        <section aria-label="Details" className="grid shrink-0 gap-x-4 gap-y-3 @lg:grid-cols-2 @3xl:grid-cols-3">
          <Field label="Customer" htmlFor="ns-customer">
            <Dropdown
              id="ns-customer"
              value={customerId}
              onChange={setCustomerId}
              placeholder="Choose a customer…"
              options={[{ value: "", label: "Choose a customer…" }, ...data.customers.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>
          <Field label="Plan" htmlFor="ns-plan" hint={`${INTERVAL_LABEL[plan.interval]} · minimum quantity ${plan.minQty}`}>
            <Dropdown id="ns-plan" value={planId} onChange={changePlan} options={data.plans.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="Payment terms" htmlFor="ns-terms">
            <Dropdown id="ns-terms" value={terms} onChange={setTerms} options={TERMS.map((t) => ({ value: t, label: t }))} />
          </Field>
          <Field label="Start" htmlFor="ns-start">
            <Input id="ns-start" type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </Field>
          <Field
            label="Expiry"
            htmlFor="ns-expiry"
            hint={expiryOverride ? <button type="button" className="underline hover:text-text" onClick={() => setExpiryOverride(null)}>Reset to plan default</button> : `${plan.interval === "yearly" ? "24" : "12"} months from the start date.`}
          >
            <Input id="ns-expiry" type="date" min={addDaysISO(start, 1)} value={expiry} onChange={(e) => e.target.value && setExpiryOverride(e.target.value)} />
          </Field>
          <Field
            label="Discount"
            htmlFor="ns-discount"
            hint={discount ? (discountApplies ? "Applied to eligible lines." : "No line is eligible yet. Check minimum quantity or purchase.") : "Only discounts that are live today are listed."}
          >
            <Dropdown
              id="ns-discount"
              value={discountId}
              onChange={setDiscountId}
              options={[{ value: "", label: "No discount" }, ...data.discounts.map((d) => ({ value: d.id, label: d.name }))]}
            />
          </Field>
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-2.5">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className={sectionTitle}>Lines</h2>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setLines((ls) => [...ls, { key: nextKey(), productId: data.products[0].id, variant: defaultVariant(data, data.products[0].id), qty: plan.minQty, taxId: defaultTax(data, data.products[0].id) }])}
            >
              <Plus size={14} /> Add line
            </button>
          </div>

          <div className={cn(surface, "flex min-h-0 flex-1 flex-col gap-2 pt-3")}>
            <div className={cn(lineGrid, "mx-3 hidden shrink-0 px-0.5 text-[12px] font-medium text-muted @2xl:grid")} aria-hidden="true">
              <span>Product</span>
              <span>Variant</span>
              <span>Tax</span>
              <span>Qty</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            <ScrollPanel className="min-h-0 flex-1 px-3 pb-3">
              <div className="space-y-2">
                {priced.length === 0 ? <p className="py-4 text-center text-[13px] text-muted">No lines yet. Add one to price the quotation.</p> : null}
                {priced.map((l, i) => {
                  const product = data.products.find((p) => p.id === l.productId);
                  const lowQty = !Number.isInteger(l.qty) || l.qty < plan.minQty;
                  return (
                    <div key={l.key} className={cn(lineGrid, "border-b border-white/[0.05] pb-3 last:border-0 last:pb-0 @2xl:border-0 @2xl:pb-0")}>
                      <Dropdown
                        aria-label={`Line ${i + 1} product`}
                        className="col-span-3 @2xl:col-span-1"
                        value={l.productId}
                        onChange={(v) => patchLine(l.key, { productId: v, variant: defaultVariant(data, v), taxId: defaultTax(data, v) })}
                        options={data.products.map((p) => ({ value: p.id, label: p.name }))}
                      />
                      <Dropdown
                        aria-label={`Line ${i + 1} variant`}
                        className="col-span-3 @2xl:col-span-1"
                        value={l.variant}
                        disabled={!product?.variants.length}
                        onChange={(v) => patchLine(l.key, { variant: v })}
                        options={
                          product?.variants.length
                            ? product.variants.map((v) => ({
                                value: v.label,
                                label: `${v.label}${v.extraPrice ? ` (+${formatMoney(v.extraPrice)})` : ""}`,
                                textValue: v.label,
                              }))
                            : [{ value: "", label: "No variants" }]
                        }
                      />
                      <TaxPicker
                        size="sm"
                        className="col-span-3 @2xl:col-span-1"
                        taxes={taxes}
                        value={l.taxId}
                        onChange={(v) => patchLine(l.key, { taxId: v })}
                        onCreate={(t) => setTaxes((ts) => [...ts, t])}
                      />
                      <Input
                        aria-label={`Line ${i + 1} quantity`}
                        aria-invalid={lowQty}
                        type="number"
                        inputMode="numeric"
                        min={plan.minQty}
                        step={1}
                        align="right"
                        value={Number.isNaN(l.qty) ? "" : l.qty}
                        className={cn("px-2", lowQty && "border-[#f43f5e]/60")}
                        onChange={(e) => patchLine(l.key, { qty: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                      />
                      <span className="hidden text-right text-[13px] text-muted tabular-nums @2xl:block">{formatMoney(l.unit)}</span>
                      <span className="text-right text-[13px] text-text tabular-nums">
                        <span className="mr-2 text-[12px] text-muted @2xl:hidden">{formatMoney(l.unit)} each</span>
                        {formatMoney(Math.round((Number.isNaN(l.qty) ? 0 : l.qty) * l.unit))}
                      </span>
                      <button
                        type="button"
                        className={cn(btnSquare, "justify-self-end hover:text-[#f43f5e]")}
                        aria-label={`Remove line ${i + 1}`}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollPanel>
          </div>
        </section>

        <div className={cn(surface, "flex shrink-0 flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3")}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2" aria-live="polite" aria-label="Totals">
            <TotalCell label="Subtotal" value={totals.subtotal} />
            <TotalCell label="Discount" value={-totals.discountTotal} />
            <TotalCell label="Tax" value={totals.taxTotal} />
            <TotalCell label={`Total per ${planUnit}`} value={totals.total} strong />
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {!valid ? <p className="mr-2 text-[12px] text-muted">{problems[0]}.</p> : null}
            <button type="button" className={btnSecondary} disabled={!customerId || send !== "idle"} onClick={saveDraft}>
              Save as Draft
            </button>
            <PrimaryDynamicButton
              type="submit"
              stateKey={send}
              disabled={!valid || send !== "idle"}
              icon={send === "idle" ? <Send size={13} /> : send === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
            >
              {send === "idle" ? "Send quotation" : send === "saving" ? "Saving…" : "Sent"}
            </PrimaryDynamicButton>
          </div>
        </div>
      </form>
    </PageGrid>
  );
}

function TotalCell({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cn("mt-0.5 tabular-nums", strong ? "text-[17px] font-medium text-text" : "text-[15px] text-text")}>{formatMoney(value)}</p>
    </div>
  );
}
